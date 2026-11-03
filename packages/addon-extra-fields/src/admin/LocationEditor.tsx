import { Button, type FieldEditorProps, TextField } from "@lintel/admin/plugin";
import { ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";
import {
  DEFAULT_ZOOM,
  formatCoordinates,
  isLatitude,
  isLongitude,
  openStreetMapEmbedUrl,
  openStreetMapUrl,
  readCoordinatesFromLink,
} from "../shared/coordinates.js";
import { t } from "./strings.js";

interface LocationDraft {
  latitude: string;
  longitude: string;
  label: string;
  address: string;
}

/**
 * The Map location field: paste a map link (the easy way) or type the coordinates, with a
 * name and address. The preview is a card with the coordinates and a link; the map itself
 * loads from OpenStreetMap only when the editor asks for it.
 */
export function LocationEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
}: FieldEditorProps) {
  const [draft, setDraft] = useState<LocationDraft>(() => readDraft(value));
  const [link, setLink] = useState("");
  const [linkMessage, setLinkMessage] = useState<{ found: boolean; text: string } | null>(null);
  const [isPreviewShown, setIsPreviewShown] = useState(false);
  const zoom = readZoom(field.options);

  const change = (next: LocationDraft) => {
    setDraft(next);
    onChange(toValue(next));
  };

  const readLink = (text: string) => {
    setLink(text);
    if (text.trim() === "") {
      setLinkMessage(null);
      return;
    }
    const found = readCoordinatesFromLink(text);
    if (!found) {
      setLinkMessage({ found: false, text: t("location.linkNotFound") });
      return;
    }
    setLinkMessage({
      found: true,
      text: t("location.linkFound", { coordinates: formatCoordinates(found) }),
    });
    change({ ...draft, latitude: String(found.latitude), longitude: String(found.longitude) });
  };

  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  const place =
    draft.latitude.trim() !== "" &&
    draft.longitude.trim() !== "" &&
    isLatitude(latitude) &&
    isLongitude(longitude)
      ? { latitude, longitude }
      : null;

  return (
    <div className="flex flex-col gap-3">
      <TextField
        id={controlId}
        label={t("location.link")}
        placeholder={t("location.linkPlaceholder")}
        value={link}
        onChange={(event) => readLink(event.target.value)}
        hint={linkMessage?.found ? linkMessage.text : undefined}
        hintTone="success"
        announcesHint
        error={linkMessage && !linkMessage.found ? linkMessage.text : undefined}
        describedBy={describedBy}
        inputMode="url"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t("location.name")}
          placeholder={t("location.namePlaceholder")}
          value={draft.label}
          maxLength={120}
          onChange={(event) => change({ ...draft, label: event.target.value })}
        />
        <TextField
          label={t("location.address")}
          value={draft.address}
          maxLength={300}
          onChange={(event) => change({ ...draft, address: event.target.value })}
        />
        <TextField
          label={t("location.latitude")}
          placeholder={t("location.latitudePlaceholder")}
          inputMode="decimal"
          value={draft.latitude}
          onChange={(event) => change({ ...draft, latitude: event.target.value })}
        />
        <TextField
          label={t("location.longitude")}
          placeholder={t("location.longitudePlaceholder")}
          inputMode="decimal"
          value={draft.longitude}
          onChange={(event) => change({ ...draft, longitude: event.target.value })}
        />
      </div>

      {place ? (
        <div className="flex flex-col gap-3 rounded-card bg-fill p-3">
          <div className="flex flex-wrap items-center gap-3">
            <MapPin aria-hidden className="size-5 shrink-0 text-accent" />
            <span className="text-body text-label">
              {draft.label.trim() || formatCoordinates(place)}
              {draft.label.trim() && (
                <span className="block text-footnote text-label-secondary">
                  {formatCoordinates(place)}
                </span>
              )}
            </span>
            <span className="ms-auto flex flex-wrap gap-2">
              <a
                className="inline-flex items-center gap-1.5 text-footnote font-medium text-accent"
                href={openStreetMapUrl(place, zoom)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("location.open")}
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </span>
          </div>
          {isPreviewShown ? (
            <div className="flex flex-col gap-2">
              <div className="relative aspect-video overflow-hidden rounded-control">
                <iframe
                  className="absolute inset-0 size-full border-0"
                  src={openStreetMapEmbedUrl(place, zoom)}
                  title={t("location.previewTitle", {
                    place: draft.label.trim() || formatCoordinates(place),
                  })}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <Button
                type="button"
                variant="plain"
                size="small"
                className="self-start"
                onClick={() => setIsPreviewShown(false)}
              >
                {t("location.hidePreview")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="tinted"
                size="small"
                onClick={() => setIsPreviewShown(true)}
              >
                {t("location.showPreview")}
              </Button>
              <span className="text-footnote text-label-secondary">
                {t("location.previewNote")}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-footnote text-label-secondary">{t("location.empty")}</p>
      )}

      {(place || draft.label || draft.address) && (
        <Button
          type="button"
          variant="plain"
          size="small"
          className="self-start"
          onClick={() => {
            setLink("");
            setLinkMessage(null);
            setIsPreviewShown(false);
            change({ latitude: "", longitude: "", label: "", address: "" });
          }}
        >
          {t("location.clear")}
        </Button>
      )}
    </div>
  );
}

function readDraft(value: unknown): LocationDraft {
  const record =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const asText = (part: unknown) =>
    typeof part === "number" ? String(part) : typeof part === "string" ? part : "";
  return {
    latitude: asText(record.latitude),
    longitude: asText(record.longitude),
    label: asText(record.label),
    address: asText(record.address),
  };
}

/** What the field stores: null while everything is empty, else the parts as typed. */
function toValue(draft: LocationDraft): Record<string, unknown> | null {
  const isEmpty = Object.values(draft).every((part) => part.trim() === "");
  if (isEmpty) return null;
  const asNumber = (text: string) => {
    const number = Number(text.trim());
    return text.trim() === "" || !Number.isFinite(number) ? null : number;
  };
  return {
    latitude: asNumber(draft.latitude),
    longitude: asNumber(draft.longitude),
    label: draft.label,
    address: draft.address,
  };
}

function readZoom(options: object): number {
  const zoom = "zoom" in options ? options.zoom : undefined;
  return typeof zoom === "number" && zoom >= 1 && zoom <= 19 ? zoom : DEFAULT_ZOOM;
}
