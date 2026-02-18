import React from "react";
import { Button, Input, Select } from "@/components/ui";
import type { ThemeSettings } from "@/types";
import { debounce } from "@/utils/async";
import {
  ensureLocationSaved,
  resolveLocationAddress,
  resolveLocationPlaceId,
  sortLocationNamesByUsage,
  splitAddressLines,
} from "@/utils/locations";
import { fetchPlaceDetails, fetchPlacePredictions, generateSessionToken } from "@/utils/mapsApi";

function AddressAutocomplete({
  value,
  placeId,
  onChange,
  placeholder,
  openMapsLabel,
}: {
  value: string;
  placeId?: string;
  onChange: (address: string, placeId: string) => void;
  placeholder?: string;
  openMapsLabel?: string;
}) {
  type PlaceSuggestion = {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { secondaryText?: { text?: string } };
    };
  };

  const [inputVal, setInputVal] = React.useState(value);
  const [predictions, setPredictions] = React.useState<PlaceSuggestion[]>([]);
  const [sessionToken] = React.useState(() => generateSessionToken());
  const [loading, setLoading] = React.useState(false);
  const [showPredictions, setShowPredictions] = React.useState(false);

  React.useEffect(() => {
    setInputVal(value);
  }, [value]);

  const fetchPredictions = React.useMemo(
    () =>
      debounce(async (input: string) => {
        if (!input.trim()) {
          setPredictions([]);
          return;
        }
        try {
          setLoading(true);
          const res = await fetchPlacePredictions(input, sessionToken);
          setPredictions(res.suggestions ?? []);
        } catch (err) {
          console.error("Places Autocomplete error:", err);
          setPredictions([]);
        } finally {
          setLoading(false);
        }
      }, 400),
    [sessionToken]
  );

  function handleInputChange(v: string) {
    setInputVal(v);
    setShowPredictions(true);
    fetchPredictions(v);
  }

  async function handleSelectPrediction(pred: PlaceSuggestion) {
    try {
      setLoading(true);
      const pId = pred.placePrediction?.placeId ?? "";
      const details = await fetchPlaceDetails(pId, sessionToken);
      onChange(details.formattedAddress ?? "", pId);
      setInputVal(details.formattedAddress ?? "");
      setPredictions([]);
      setShowPredictions(false);
    } catch (err) {
      console.error("Place Details error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <Input value={inputVal} onChange={handleInputChange} placeholder={placeholder ?? "..."} />
      {loading && (
        <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--ui-muted)" }}>
          ...
        </div>
      )}
      {showPredictions && predictions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--ui-bg)",
            border: "1px solid var(--ui-border)",
            borderRadius: 8,
            marginTop: 4,
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {predictions.map((pred, idx) => {
            const text = pred.placePrediction?.text?.text ?? "";
            const desc = pred.placePrediction?.structuredFormat?.secondaryText?.text ?? "";
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPrediction(pred)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  borderBottom: idx < predictions.length - 1 ? "1px solid var(--ui-border)" : "none",
                  fontSize: 13,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ui-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontWeight: 600 }}>{text}</div>
                {desc && <div style={{ fontSize: 11, color: "var(--ui-muted)", marginTop: 2 }}>{desc}</div>}
              </button>
            );
          })}
        </div>
      )}
      {placeId && (
        <div
          style={{
            fontSize: 10,
            color: "var(--ui-muted)",
            marginTop: 4,
            wordBreak: "break-all",
            overflowWrap: "anywhere",
          }}
        >
          ID: {placeId.slice(0, 20)}...
        </div>
      )}
      <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-start", flexWrap: "wrap", minWidth: 0 }}>
        <button
          type="button"
          onClick={() => {
            const q = encodeURIComponent((inputVal || value || "").trim());
            if (!q) return;
            window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
          }}
          style={{
            border: "1px solid var(--ui-border)",
            borderRadius: 10,
            padding: "6px 9px",
            background: "transparent",
            color: "var(--ui-text)",
            fontWeight: 900,
            fontSize: 11,
            cursor: "pointer",
            maxWidth: "100%",
            minWidth: 0,
            whiteSpace: "normal",
            textAlign: "left",
            lineHeight: 1.2,
          }}
          title={openMapsLabel ?? "Google Maps"}
        >
          🗺️ {openMapsLabel ?? "Google Maps"}
        </button>
      </div>
    </div>
  );
}

function LocationCard({
  name,
  def,
  isPreset,
  usageCount,
  locData,
  onToggle,
  open,
  onRemove,
  onDefChange,
  onAddressChange,
  t,
}: {
  name: string;
  def: { abbr: string; name: string; hallNo?: string };
  isPreset: boolean;
  usageCount: number;
  locData: { address: string; placeId?: string };
  open: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onDefChange: (next: { abbr: string; name: string; hallNo?: string }) => void;
  onAddressChange: (addr: string, placeId: string) => void;
  t: (k: string) => string;
}) {
  const hasMaps = Boolean(locData.placeId);
  const [line1, line2] = (() => {
    const lines = splitAddressLines(locData.address ?? "");
    return [lines[0] ?? "", lines.slice(1).join(", ") ?? ""];
  })();

  const setManualAddress = (nextLine1: string, nextLine2: string) => {
    const next = [nextLine1.trim(), nextLine2.trim()].filter(Boolean).join(", ");
    onAddressChange(next, "");
  };

  return (
    <div
      style={{
        border: "1px solid var(--ui-border)",
        borderRadius: 14,
        background: "var(--ui-card)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          color: "var(--ui-text)",
          cursor: "pointer",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {def.name || name}
          </div>
          <div style={{ fontSize: 12, color: "var(--ui-muted)", fontWeight: 800, marginTop: 2 }}>
            {def.abbr ? `${t("abbr")}: ${def.abbr}` : `${t("abbr")}: —`}
            {def.hallNo ? `  •  ${t("hall")} ${def.hallNo}` : ""}
            {hasMaps ? `  •  ${t("maps")} ✓` : `  •  ${t("maps")} —`}
            {`  •  ${t("used")}: ${usageCount}`}
          </div>
        </div>

        <div style={{ color: "var(--ui-muted)", fontWeight: 900, flexShrink: 0 }}>{open ? "▲" : "▼"}</div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--ui-border)", padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                {t("label")}
              </div>
              <Input value={def.name} onChange={(v) => onDefChange({ ...def, name: v })} placeholder={t("locationNameExample")} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                {t("abbreviation")}
              </div>
              <Input value={def.abbr} onChange={(v) => onDefChange({ ...def, abbr: v })} placeholder={t("abbrExample")} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
                {t("hallNumber")}
              </div>
              <Input value={def.hallNo ?? ""} onChange={(v) => onDefChange({ ...def, hallNo: v })} placeholder={t("optional")} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 950, color: "var(--ui-muted)", marginBottom: 6, textTransform: "uppercase" }}>
              {t("addressGoogleAutocomplete")}
            </div>
            <AddressAutocomplete
              value={locData.address}
              placeId={locData.placeId}
              onChange={onAddressChange}
              placeholder={t("searchAddress")}
              openMapsLabel={t("openInGoogleMaps")}
            />
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <Input
                value={line1}
                onChange={(v) => setManualAddress(v, line2)}
                placeholder={t("addressLine1")}
              />
              <Input
                value={line2}
                onChange={(v) => setManualAddress(line1, v)}
                placeholder={t("addressLine2")}
              />
            </div>
          </div>

          {!isPreset && onRemove && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,.55)",
                  background: "transparent",
                  color: "#ef4444",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                {t("remove")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LocationsPanel({
  theme,
  setTheme,
  locationUsageMap,
  requestedOpenName,
  t,
}: {
  theme: ThemeSettings;
  setTheme: (t: ThemeSettings) => void;
  locationUsageMap: Record<string, number>;
  requestedOpenName?: string | null;
  t: (k: string) => string;
}) {
  const loc = theme.locations ?? {};
  const [homeLocationName, setHomeLocationName] = React.useState("");

  function setHomeAddress(address: string, placeId: string) {
    setTheme({
      ...theme,
      locations: { ...(theme.locations ?? {}), homeAddress: address, homePlaceId: placeId },
    });
  }

  function setLocationAddress(name: string, address: string, placeId: string) {
    const locs = theme.locations?.locations ?? {};
    setTheme({
      ...theme,
      locations: {
        ...(theme.locations ?? {}),
        locations: { ...locs, [name]: { address, placeId } },
      },
    });
  }

  function removeLocation(name: string) {
    const locs = { ...(theme.locations?.locations ?? {}) };
    delete locs[name];
    setTheme({ ...theme, locations: { ...(theme.locations ?? {}), locations: locs } });
  }

  function getDef(name: string) {
    const defs = theme.locations?.definitions ?? {};
    return defs[name] ?? { abbr: name, name, hallNo: "" };
  }

  function setDef(name: string, next: { abbr: string; name: string; hallNo?: string }) {
    const normalized = {
      name: String(next.name ?? "").trim().replace(/\s+/g, " "),
      abbr: String(next.abbr ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase(),
      hallNo: String(next.hallNo ?? "")
        .trim()
        .replace(/\s+/g, " "),
    };
    setTheme({
      ...theme,
      locations: {
        ...(theme.locations ?? {}),
        definitions: {
          ...(theme.locations?.definitions ?? {}),
          [name]: normalized,
        },
      },
    });
  }

  const presetNames = ["BSH", "SHP", "Seminarraum"];
  const customLocationNames = Object.keys(loc.locations ?? {}).filter((n) => !presetNames.includes(n));

  const [openName, setOpenName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!requestedOpenName) return;
    setOpenName(requestedOpenName);
  }, [requestedOpenName]);

  const allNames = sortLocationNamesByUsage([...new Set([...presetNames, ...customLocationNames])], locationUsageMap);
  const locationNamesWithAddress = allNames.filter((name) => Boolean(resolveLocationAddress(name, theme)));

  function selectHomeFromLocation(name: string) {
    const address = resolveLocationAddress(name, theme);
    const placeId = resolveLocationPlaceId(name, theme);
    setHomeAddress(address, placeId);
  }

  function saveHomeAsLocation() {
    const name = homeLocationName.trim().replace(/\s+/g, " ");
    const homeAddress = String(loc.homeAddress ?? "").trim();
    const homePlaceId = String(loc.homePlaceId ?? "").trim();
    if (!name || !homeAddress) return;

    ensureLocationSaved(theme, setTheme, name);
    setLocationAddress(name, homeAddress, homePlaceId);
    if (!(theme.locations?.definitions ?? {})[name]) {
      setDef(name, { abbr: "", name, hallNo: "" });
    }
    setOpenName(name);
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("home")}</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
          <Select
            value=""
            onChange={(v) => {
              if (!v) return;
              selectHomeFromLocation(v);
            }}
            options={[
              { value: "", label: `— ${t("useLocationAsHome")} —` },
              ...locationNamesWithAddress.map((name) => ({
                value: name,
                label: `${name} (${t("used")}: ${locationUsageMap[name] ?? 0})`,
              })),
            ]}
          />
        </div>
        <AddressAutocomplete
          value={loc.homeAddress ?? ""}
          placeId={loc.homePlaceId}
          onChange={setHomeAddress}
          placeholder={t("startPointOptional")}
          openMapsLabel={t("openInGoogleMaps")}
        />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
          <Input
            value={homeLocationName}
            onChange={setHomeLocationName}
            placeholder={t("homeLocationNamePlaceholder")}
            style={{ flex: "1 1 220px", minWidth: 0 }}
          />
          <Button
            variant="outline"
            onClick={saveHomeAsLocation}
            style={{
              flex: "1 1 220px",
              minWidth: 0,
              whiteSpace: "normal",
              lineHeight: 1.2,
              textAlign: "center",
            }}
          >
            {t("saveHomeAsLocation")}
          </Button>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>{t("trainingAndGameLocations")}</div>

        <div style={{ display: "grid", gap: 10 }}>
          {allNames.map((name) => {
            const isPreset = presetNames.includes(name);
            const locData = loc.locations?.[name] ?? { address: "", placeId: undefined };
            const def = getDef(name);

            return (
              <LocationCard
                key={name}
                name={name}
                def={def}
                isPreset={isPreset}
                usageCount={locationUsageMap[name] ?? 0}
                locData={locData}
                open={openName === name}
                onToggle={() => setOpenName(openName === name ? null : name)}
                onRemove={!isPreset ? () => removeLocation(name) : undefined}
                onDefChange={(next) => setDef(name, next)}
                onAddressChange={(addr, pId) => setLocationAddress(name, addr, pId)}
                t={t}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LeftLocationsView({
  theme,
  setTheme,
  locationUsageMap,
  editMode,
  openLocationName,
  setOpenLocationName,
  t,
}: {
  theme: ThemeSettings;
  setTheme: (t: ThemeSettings) => void;
  locationUsageMap: Record<string, number>;
  editMode: boolean;
  openLocationName: string | null;
  setOpenLocationName: (v: string | null) => void;
  t: (k: string) => string;
}) {
  if (editMode) {
    return (
      <LocationsPanel
        theme={theme}
        setTheme={setTheme}
        locationUsageMap={locationUsageMap}
        requestedOpenName={openLocationName}
        t={t}
      />
    );
  }

  const L = theme.locations ?? {};
  const locs = L.locations ?? {};
  const defs = L.definitions ?? {};

  const names = sortLocationNamesByUsage(Object.keys(locs), locationUsageMap);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{t("locations")}</div>
      <div style={{ color: "var(--ui-muted)", fontSize: 13, fontWeight: 800 }}>{t("locationsHintExpand")}</div>

      <div style={{ display: "grid", gap: 8 }}>
        {names.map((name) => {
          const isOpen = openLocationName === name;
          const addr = locs[name]?.address ?? "";
          const def = defs[name] ?? { abbr: "", name: name, hallNo: "" };

          return (
            <div
              key={name}
              style={{
                border: "1px solid var(--ui-border)",
                borderRadius: 14,
                background: "var(--ui-card)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenLocationName(isOpen ? null : name)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  color: "var(--ui-text)",
                  padding: "12px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 950, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {def.name || name}
                </div>
                <div style={{ color: "var(--ui-muted)", fontWeight: 900, flexShrink: 0 }}>{def.abbr ? def.abbr : name}</div>
                {def.hallNo ? <div style={{ color: "var(--ui-muted)", fontWeight: 900, flexShrink: 0 }}>Halle {def.hallNo}</div> : null}
                <div style={{ color: "var(--ui-muted)", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
                  {t("used")}: {locationUsageMap[name] ?? 0}
                </div>
                <div style={{ color: "var(--ui-muted)", fontWeight: 900, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</div>
              </button>

              {isOpen && (
                <div style={{ borderTop: "1px solid var(--ui-border)", padding: 12, display: "grid", gap: 6 }}>
                  {addr ? (
                    splitAddressLines(addr).map((line, idx) => (
                      <div key={idx} style={{ fontSize: 12, fontWeight: 800, color: "var(--ui-text)" }}>
                        {line}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 900, color: "var(--ui-muted)" }}>{t("locationsNoAddress")}</div>
                  )}

                  {locs[name]?.placeId ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--ui-muted)",
                        fontWeight: 900,
                        wordBreak: "break-all",
                        overflowWrap: "anywhere",
                      }}
                    >
                      PlaceId: {locs[name].placeId}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {names.length === 0 && <div style={{ color: "var(--ui-muted)", fontWeight: 900 }}>{t("locationsEmpty")}</div>}
      </div>
    </div>
  );
}
