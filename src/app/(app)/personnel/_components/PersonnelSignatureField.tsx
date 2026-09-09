"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, PenLine, PenOff } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  uploadPersonnelSignatureAction,
  removePersonnelSignatureAction,
  type SignatureActionResult,
} from "@/features/server-boundary/personnel-signature-actions";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_MIME = "image/png";

export interface PersonnelSignatureFieldProps {
  personnelId: string;
  /**
   * Display name of the signatory this control acts on - a Pathologist or a Medical
   * Technologist, both of which the server accepts a signature image for. Named in the
   * removal confirmation.
   */
  personnelName: string;
  /** Server-derived. This control never receives the signature reference itself. */
  hasSignature: boolean;
  onSignatureChanged: (hasSignature: boolean) => void;
  /**
   * Raised while this control holds a confirmation dialog open.
   *
   * The confirmation is a dialog inside the personnel dialog, and both listen for Escape on
   * the document. Without this, one Escape press would dismiss the confirmation *and* discard
   * the whole edit form underneath it. The parent uses the flag to stop the outer dialog
   * dismissing while the inner one is answering a question.
   */
  onConfirmationOpenChange?: (isOpen: boolean) => void;
  /**
   * Raised while an upload or a removal is in flight.
   *
   * The guards below stop a second write starting inside this control, but the dialog that
   * contains it has dismissal routes of its own - Escape, the backdrop, the close control and
   * Cancel - and none of them know a write is running. Reporting the state upward is what lets
   * the dialog withhold those routes until the operation settles, rather than tearing the
   * control down while its request is still outstanding.
   */
  onBusyChange?: (isBusy: boolean) => void;
}

export function PersonnelSignatureField({
  personnelId,
  personnelName,
  hasSignature,
  onSignatureChanged,
  onConfirmationOpenChange,
  onBusyChange,
}: PersonnelSignatureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);

  // Declared above the handlers because every one of them is gated on it. An upload and a
  // removal are writes against the same stored object, so a second one started while the first
  // is in flight would settle in an order neither the control nor the record can predict.
  // Disabled attributes alone do not cover a drop, which needs no control to fire.
  const isBusy = isUploading || isRemoving;

  // `isBusy` drives what the reader sees; this ref is the guard that state cannot be. A state
  // update reaches these handlers only after a render, so two events dispatched in the same
  // tick - two drops, or a removal confirmed on top of an upload - both read the stale value
  // and both write against the same stored object. The ref is current the instant the first
  // operation claims it, so it is the authoritative gate and the state stays the indicator.
  const operationClaimedRef = useRef(false);

  // Reported on every transition, so the dialog above is locked the moment a write starts and
  // released the moment it settles - success or failure alike, since both paths clear the two
  // flags this derives from in their `finally`. The unmount cleanup releases it as well, so a
  // control torn down mid-write never leaves the dialog stuck closed to its own controls.
  useEffect(() => {
    onBusyChange?.(isBusy);
    return () => onBusyChange?.(false);
  }, [isBusy, onBusyChange]);

  const processFile = useCallback(
    async (file: File) => {
      // Checked before anything else happens. The `isBusy` guards in the callers above lag by
      // a render; this does not, so a second drop or picked file in the same tick stops here.
      if (operationClaimedRef.current) return;

      setError(null);

      if (file.type !== ACCEPTED_MIME) {
        setError("Only PNG files are accepted.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError("File exceeds the maximum size of 2 MB.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Claimed synchronously, before the first await below, so anything arriving while this
      // upload runs is refused at the check above instead of starting a parallel write.
      operationClaimedRef.current = true;
      setIsUploading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        const result: SignatureActionResult = await uploadPersonnelSignatureAction({
          personnelId,
          fileBase64: base64,
          fileName: file.name,
        });

        if (result.success) {
          onSignatureChanged(result.hasSignature);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Upload failed. Please try again.");
      } finally {
        operationClaimedRef.current = false;
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [personnelId, onSignatureChanged]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isBusy) {
        event.target.value = "";
        return;
      }
      const file = event.target.files?.[0];
      if (file) processFile(file);
    },
    [isBusy, processFile]
  );

  const handleBrowseClick = useCallback(() => {
    if (isBusy) return;
    fileInputRef.current?.click();
  }, [isBusy]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      // The default is still cancelled above, so a file dropped mid-write is neither opened by
      // the browser nor started as a second upload. It is simply ignored.
      if (isBusy) return;

      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) {
        setError("Please drop exactly one PNG file.");
        return;
      }
      processFile(files[0]);
    },
    [isBusy, processFile]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      // Cancelled either way, so the browser never opens a dropped file itself. While a write
      // is in flight the drag is refused as well, so the cursor says no before the drop.
      event.preventDefault();
      event.stopPropagation();
      if (isBusy) event.dataTransfer.dropEffect = "none";
    },
    [isBusy]
  );

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (isBusy) return;
      setIsDragOver(true);
    },
    [isBusy]
  );

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * Removal is a direct, unrecoverable write against stored personnel data, so it is asked
   * about before it happens rather than reported afterwards. The confirmation is the only
   * thing added here: the server action, the storage object, the audit trail and the
   * signatures already snapshotted onto completed reports are untouched by this step.
   */
  const openRemovalConfirmation = useCallback(() => {
    if (isBusy) return;
    setError(null);
    setIsConfirmingRemoval(true);
    onConfirmationOpenChange?.(true);
  }, [isBusy, onConfirmationOpenChange]);

  const closeRemovalConfirmation = useCallback(() => {
    setIsConfirmingRemoval(false);
    onConfirmationOpenChange?.(false);
  }, [onConfirmationOpenChange]);

  const handleConfirmRemoval = useCallback(async () => {
    if (isBusy) return;
    // The confirmation is a second entry point into the same stored object, and it can be
    // answered in the same tick an upload starts - before either disabled state has rendered.
    if (operationClaimedRef.current) return;
    operationClaimedRef.current = true;
    setError(null);
    setIsRemoving(true);
    try {
      const result: SignatureActionResult =
        await removePersonnelSignatureAction({ personnelId });
      if (result.success) {
        onSignatureChanged(result.hasSignature);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Removal failed. Please try again.");
    } finally {
      operationClaimedRef.current = false;
      setIsRemoving(false);
      setIsConfirmingRemoval(false);
      onConfirmationOpenChange?.(false);
    }
  }, [isBusy, personnelId, onSignatureChanged, onConfirmationOpenChange]);

  return (
    <>
      {/* A structural tint block inside the white form: the drop zone is a grouping of the
          record's signature facts and controls, not a second card. */}
      <div
        aria-disabled={isBusy || undefined}
        className={[
          "rounded-lg border p-3 transition-colors",
          isDragOver && !isBusy
            ? "border-dashed border-brand-primary bg-brand-info-bg"
            : "border-brand-border bg-brand-structural",
          // Reduced emphasis while a write runs, matching the state the controls inside it are
          // already in. No drag-over highlight can appear on top of it.
          isBusy ? "opacity-60" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">
                Signature Image
              </span>
              {/* Stated, never flagged. The image is optional, so its absence is a fact about the
                  record and not a defect in it - same vocabulary and same neutral treatment the
                  directory row uses, so the two never disagree in a reader's memory. The fact
                  sits on a white chip, lifted off the tint the way the form's fields are. */}
              {hasSignature ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-surface px-2 py-0.5 text-[11px] text-brand-text-muted">
                  <PenLine aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span aria-hidden="true">On file</span>
                  <span className="sr-only">Signature on file</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-surface px-2 py-0.5 text-[11px] text-brand-text-muted">
                  <PenOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span aria-hidden="true">None on file</span>
                  <span className="sr-only">No signature on file</span>
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-brand-text-muted">
              Optional. PNG only, maximum 2 MB. Drag a file here or use the button. Without an
              image, reports carry the printed name, credentials and PRC licence instead. Applied
              to reports completed from now on; previously completed reports keep the signature
              they were issued with.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Driven by the button beside it, so it is out of the Tab order - but a screen
                reader's form-controls list still lands on it, where it previously announced
                itself with no name at all. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              tabIndex={-1}
              aria-label={`Choose a PNG signature image for ${personnelName}`}
              disabled={isBusy}
              onChange={handleFileInputChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isUploading}
              disabled={isBusy}
              onClick={handleBrowseClick}
              className="min-h-11 sm:min-h-8"
              aria-label={`${hasSignature ? "Replace" : "Upload"} the signature image for ${personnelName}`}
            >
              {!isUploading && <Upload aria-hidden="true" className="h-3.5 w-3.5" />}
              <span className="text-xs">
                {isUploading ? "Uploading..." : hasSignature ? "Replace" : "Upload"}
              </span>
            </Button>
            {hasSignature && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isRemoving}
                disabled={isBusy}
                onClick={openRemovalConfirmation}
                className="min-h-11 text-brand-danger hover:border-brand-danger-border hover:bg-brand-danger-bg sm:min-h-8"
                aria-label={`Remove the signature image for ${personnelName}`}
              >
                {!isRemoving && <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
                <span className="text-xs">{isRemoving ? "Removing..." : "Remove"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Both writes are silent to a screen reader otherwise: the spinner is decorative and the
            button label alone does not announce itself when it changes. */}
        <p aria-live="polite" className="sr-only">
          {isUploading
            ? "Uploading signature image."
            : isRemoving
              ? "Removing signature image."
              : ""}
        </p>

        {error && (
          <div className="mt-2.5">
            <Alert variant="destructive" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmingRemoval}
        onCancel={closeRemovalConfirmation}
        onConfirm={handleConfirmRemoval}
        title="Remove signature image?"
        description={`This removes the stored signature image for ${personnelName}.`}
        confirmLabel="Remove image"
        pendingLabel="Removing..."
        variant="destructive"
        isPending={isRemoving}
      >
        <p>
          Reports completed from now on will carry this person&rsquo;s textual signatory
          information - printed name, credentials and PRC licence number - in place of the
          image. Reports already completed keep the signature they were issued with.
        </p>
        <p className="mt-2 text-brand-text-muted">
          A signature image can be uploaded again at any time.
        </p>
      </ConfirmDialog>
    </>
  );
}
