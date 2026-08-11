"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FlaskConical, MapPin, Sparkles, Upload } from "lucide-react";

import type { Project } from "@/types/assessment";
import { Panel, PanelHeader, ScreeningDisclaimer } from "@/components/ui/Primitives";
import { track } from "@/lib/analytics/client";

type Mode = "file" | "coordinates";

interface CreateAssessmentProps {
  demoMode: boolean;
  onProjectReady: (project: Project, warnings: string[]) => void;
  busy: boolean;
}

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const INVESTOR_DEMO_KMZ = "/demo/legalmine-investor-full-analysis-demo.kmz";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

export default function CreateAssessment({
  demoMode,
  onProjectReady,
  busy,
}: CreateAssessmentProps) {
  const [mode, setMode] = useState<Mode>("file");
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [investorDemo, setInvestorDemo] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("1000");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el límite es 12 MB. Simplifica el polígono antes de subirlo.`,
      );
      return;
    }
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "kmz") {
      setFileBase64(arrayBufferToBase64(await file.arrayBuffer()));
      setFileText(null);
    } else {
      setFileText(await file.text());
      setFileBase64(null);
    }
    setInvestorDemo(false);
    setFileName(file.name);
    if (!name.trim()) setName(file.name.replace(/\.[^/.]+$/, ""));
    track("geometry_uploaded", { format: file.name.split(".").pop(), bytes: file.size });
  }

  async function createProject(body: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        project?: Project;
        warnings?: string[];
        error?: string;
        detail?: string;
      };
      if (!response.ok || !payload.project) {
        setError([payload.error, payload.detail].filter(Boolean).join(" ") || "No se pudo crear el proyecto.");
        return;
      }
      track("assessment_started", { mode });
      onProjectReady(payload.project, payload.warnings ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error de red.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadInvestorDemoKmz() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(INVESTOR_DEMO_KMZ);
      if (!response.ok) throw new Error(`No se pudo cargar el KMZ demo (${response.status}).`);
      const buffer = await response.arrayBuffer();
      setMode("file");
      setName("Investor Demo - Full Due Diligence");
      setFileName("legalmine-investor-full-analysis-demo.kmz");
      setFileText(null);
      setFileBase64(arrayBufferToBase64(buffer));
      setInvestorDemo(true);
      track("investor_demo_kml_loaded", { source: "predefined_kmz" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el KML demo.");
    } finally {
      setSubmitting(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Ponle un nombre al proyecto para poder identificar el dossier después.");
      return;
    }
    if (mode === "file") {
      if (!fileText && !fileBase64) {
        setError("Sube un archivo .geojson, .kml o .kmz que contenga el área de interés.");
        return;
      }
      void createProject({
        name,
        geometryText: fileText,
        geometryBase64: fileBase64,
        filename: fileName,
        investorDemo,
      });
      return;
    }
    const lat = Number.parseFloat(latitude);
    const lon = Number.parseFloat(longitude);
    const radiusMeters = Number.parseFloat(radius);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusMeters)) {
      setError("Latitud, longitud y radio deben ser números, en grados decimales y metros.");
      return;
    }
    void createProject({ name, latitude: lat, longitude: lon, radiusMeters });
  }

  const disabled = submitting || busy;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <Panel className="p-6">
        <PanelHeader
          title="Nuevo análisis"
          subtitle="Define el área que quieres tamizar. La geometría se valida y se le calcula una huella, así que el mismo polígono siempre produce el mismo resultado."
        />

        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block text-xs font-semibold text-gray-400">
            Nombre del proyecto
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ej. Bloque Inambari — tamizaje de opción"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
            />
          </label>

          <div className="flex gap-2">
            {(
              [
                { id: "file" as const, label: "Subir KMZ / KML / GeoJSON", icon: Upload },
                { id: "coordinates" as const, label: "Punto central + radio", icon: MapPin },
              ]
            ).map((option) => {
              const Icon = option.icon;
              const active = mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-blue-500 bg-blue-600/20 text-blue-300"
                      : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>

          {mode === "file" ? (
            <div>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-8 text-center transition hover:border-blue-500/50 hover:bg-blue-500/5"
              >
                <Upload className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-semibold text-gray-200">
                  {fileName ?? "Elige un archivo .geojson, .json, .kml o .kmz"}
                </span>
                <span className="text-[11px] text-gray-500">
                  Polígonos y multipolígonos en WGS84 grados decimales. Se rechazan puntos y líneas.
                </span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".kmz,.kml,.geojson,.json"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-gray-400">
                Latitud
                <input
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="-12.915"
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="text-xs font-semibold text-gray-400">
                Longitud
                <input
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="-69.84"
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="text-xs font-semibold text-gray-400">
                Radio (m)
                <input
                  value={radius}
                  onChange={(event) => setRadius(event.target.value)}
                  inputMode="numeric"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <p className="sm:col-span-3 text-[11px] leading-relaxed text-gray-500">
                Genera un cuadro delimitador alrededor del punto. Es una aproximación para tamizaje, no un
                límite levantado en campo, y el dossier lo declara así.
              </p>
            </div>
          )}

          {error ? (
            <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Demo para inversionistas
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                  Precarga un KMZ de ejemplo para recorrer el flujo completo: concesion minera, REINFO,
                  areas protegidas, agua, territorio, vegetacion, mapa, radar y dossier.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void loadInvestorDemoKmz()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Precargar KMZ
                </button>
                <a
                  href={INVESTOR_DEMO_KMZ}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[11px] font-semibold text-gray-300 transition hover:bg-white/5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar KMZ
                </a>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {disabled ? "Working…" : "Validate area and check sources"}
          </button>
        </form>
      </Panel>

      {demoMode ? (
        <Panel className="p-5" demo>
          <PanelHeader
            title="Or run the labelled demonstration case"
            subtitle="Fictional records, real engine. Every finding is watermarked DEMO and no government service is queried."
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => void createProject({ demo: true })}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/15 px-4 py-2.5 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:opacity-60"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Load demo assessment
          </button>
        </Panel>
      ) : null}

      <ScreeningDisclaimer />
    </div>
  );
}
