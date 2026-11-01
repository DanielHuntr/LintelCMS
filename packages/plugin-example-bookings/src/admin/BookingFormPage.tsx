import {
  Button,
  Card,
  ConfirmDialog,
  controlClasses,
  describeError,
  LargeTitle,
  LoadError,
  PluginBackLink,
  type PluginScreenProps,
  TextField,
  useCan,
  usePluginNavigate,
} from "@lintel/admin/plugin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";
import type { Booking, BookingInput } from "../server/bookings.schema.js";
import { cancelBooking, createBooking, getBooking, updateBooking } from "./bookings.api.js";
import { toLocalInputValue } from "./dates.js";
import { t } from "./strings.js";

/** /bookings/new and /bookings/$bookingId: one booking's form. */
export function BookingFormPage({ params }: PluginScreenProps) {
  const bookingId = params.bookingId ?? "new";
  const existing = useQuery({
    queryKey: ["bookings", bookingId],
    queryFn: () => getBooking(bookingId),
    enabled: bookingId !== "new",
  });

  if (bookingId === "new") return <BookingForm />;
  if (existing.isError) {
    return <LoadError error={existing.error} onRetry={() => void existing.refetch()} />;
  }
  if (!existing.data)
    return <p className="text-body text-label-secondary">{t("bookings.loading")}</p>;
  return <BookingForm key={existing.data.id} booking={existing.data} />;
}

function BookingForm({ booking }: { booking?: Booking }) {
  const canManage = useCan("bookings:manage");
  const navigate = usePluginNavigate();
  const queryClient = useQueryClient();
  const notesId = useId();
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [values, setValues] = useState({
    customerName: booking?.customerName ?? "",
    customerEmail: booking?.customerEmail ?? "",
    startsAt: booking ? toLocalInputValue(booking.startsAt) : "",
    durationMinutes: booking ? String(booking.durationMinutes) : "",
    notes: booking?.notes ?? "",
  });

  const finished = async () => {
    await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    await navigate("/bookings");
  };
  const save = useMutation({
    mutationFn: (input: BookingInput) =>
      booking ? updateBooking(booking.id, input) : createBooking(input),
    onSuccess: finished,
  });
  const cancel = useMutation({
    mutationFn: () => cancelBooking(booking?.id ?? ""),
    onSuccess: finished,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate({
      customerName: values.customerName,
      customerEmail: values.customerEmail.trim(),
      // An empty or unreadable date is sent as it is, so the API can explain what's missing.
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : "",
      durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : undefined,
      notes: values.notes,
    });
  }

  const field = (name: keyof typeof values) => ({
    value: values[name],
    disabled: !canManage,
    onChange: (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <>
      <PluginBackLink to="/bookings">{t("bookings.back")}</PluginBackLink>
      <LargeTitle
        title={
          booking ? t("bookings.editTitle", { name: booking.customerName }) : t("bookings.newTitle")
        }
        subtitle={canManage ? t("bookings.formSubtitle") : t("bookings.readOnly")}
      />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <TextField
            label={t("bookings.customerName")}
            autoComplete="off"
            required
            {...field("customerName")}
          />
          <TextField
            label={t("bookings.customerEmail")}
            type="email"
            autoComplete="off"
            required
            {...field("customerEmail")}
          />
          <TextField
            label={t("bookings.startsAt")}
            type="datetime-local"
            required
            {...field("startsAt")}
          />
          <TextField
            label={t("bookings.duration")}
            type="number"
            min={5}
            max={480}
            step={5}
            hint={t("bookings.durationHint")}
            {...field("durationMinutes")}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={notesId} className="text-footnote font-medium text-label">
              {t("bookings.notes")}
            </label>
            <textarea id={notesId} rows={3} className={controlClasses()} {...field("notes")} />
          </div>
          {(save.error ?? cancel.error) && (
            <p role="alert" className="text-footnote whitespace-pre-line text-danger">
              {describeError(save.error ?? cancel.error)}
            </p>
          )}
          {canManage && (
            <div className="flex flex-wrap justify-between gap-3">
              {booking ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsConfirmingCancel(true)}
                >
                  {t("bookings.cancelBooking")}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("bookings.saving") : t("bookings.save")}
              </Button>
            </div>
          )}
        </form>
      </Card>
      <ConfirmDialog
        open={isConfirmingCancel}
        title={t("bookings.cancelTitle")}
        message={t("bookings.cancelMessage", { name: booking?.customerName ?? "" })}
        confirmLabel={t("bookings.cancelBooking")}
        cancelLabel={t("bookings.keep")}
        isDestructive
        isWorking={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setIsConfirmingCancel(false)}
      />
    </>
  );
}
