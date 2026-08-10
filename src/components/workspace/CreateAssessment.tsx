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
const INVESTOR_DEMO_KML = "/demo/legalmine-investor-concession-demo.kml";

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
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 12 MB; simplify the polygon before uploading.`);
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
        setError([payload.error, payload.detail].filter(Boolean).join(" ") || "The project could not be created.");
        return;
      }
      track("assessment_started", { mode });
      onProjectReady(payload.project, payload.warnings ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadInvestorDemoKml() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(INVESTOR_DEMO_KML);
      if (!response.ok) throw new Error(`No se pudo cargar el KML demo (${response.status}).`);
      const text = await response.text();
      setMode("file");
      setName("Investor Demo - Concession Screening");
      setFileName("legalmine-investor-concession-demo.kml");
      setFileText(text);
      setFileBase64(null);
      track("investor_demo_kml_loaded", { source: "predefined_kml" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el KML demo.");
    } finally {
      setSubmitting(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the project a name so the dossier can be identified later.");
      return;
    }
    if (mode === "file") {
      if (!fileText && !fileBase64) {
        setError("Upload a .geojson, .kml or .kmz file that contains the area of interest.");
        return;
      }
      void createProject({
        name,
        geometryText: fileText,
        geometryBase64: fileBase64,
        filename: fileName,
      });
      return;
    }
    const lat = Number.parseFloat(latitude);
    const lon = Number.parseFloat(longitude);
    const radiusMeters = Number.parseFloat(radius);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusMeters)) {
      setError("Latitude, longitude and radius must all be numbers in decimal degrees and metres.");
      return;
    }
    void createProject({ name, latitude: lat, longitude: lon, radiusMeters });
  }

  const disabled = submitting || busy;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <Panel className="p-6">
        <PanelHeader
          title="Create assessment"
          subtitle="Define the area you want to screen. The geometry is validated and fingerprinted, so the same polygon always produces the same result."
        />

        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block text-xs font-semibold text-gray-400">
            Project name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Inambari block — option screening"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
            />
          </label>

          <div className="flex gap-2">
            {(
              [
                { id: "file" as const, label: "Upload KMZ / KML / GeoJSON", icon: Upload },
                { id: "coordinates" as const, label: "Centre point + radius", icon: MapPin },
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
                  {fileName ?? "Choose a .geojson, .json, .kml or .kmz file"}
                </span>
                <span className="text-[11px] text-gray-500">
                  Polygons and multipolygons in WGS84 decimal degrees. Points and paths are rejected.
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
                Latitude
                <input
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="-12.915"
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="text-xs font-semibold text-gray-400">
                Longitude
                <input
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="-69.84"
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="text-xs font-semibold text-gray-400">
                Radius (m)
                <input
                  value={radius}
                  onChange={(event) => setRadius(event.target.value)}
                  inputMode="numeric"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-blue-500"
                />
              </label>
              <p className="sm:col-span-3 text-[11px] leading-relaxed text-gray-500">
                This generates a bounding box around the point. It is an approximation for screening,
                not a surveyed boundary, and the dossier says so.
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
                  Precarga un KML de ejemplo para mostrar el flujo de concesion minera, mapa de
                  evidencia, radar y dossier sin preparar un archivo externo.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void loadInvestorDemoKml()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Precargar KML
                </button>
                <a
                  href={INVESTOR_DEMO_KML}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[11px] font-semibold text-gray-300 transition hover:bg-white/5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar
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
