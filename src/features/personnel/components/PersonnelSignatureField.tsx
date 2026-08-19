"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, Trash2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  uploadPersonnelSignatureAction,
  removePersonnelSignatureAction,
  type SignatureActionResult,
} from "@/features/server-boundary/personnel-signature-actions";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_MIME = "image/png";

export interface PersonnelSignatureFieldProps {
  personnelId: string;
  signatureImageUrl: string | null | undefined;
  onSignatureChanged: (newUrl: string | null) => void;
}

export function PersonnelSignatureField({
  personnelId,
  signatureImageUrl,
  onSignatureChanged,
}: PersonnelSignatureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasSignature = !!signatureImageUrl;

  const processFile = useCallback(
    async (file: File) => {
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
          onSignatureChanged(result.signatureImageUrl);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [personnelId, onSignatureChanged]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) {
        setError("Please drop exactly one PNG file.");
        return;
      }
      processFile(files[0]);
    },
    [processFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleRemove = useCallback(async () => {
    setError(null);
    setIsRemoving(true);
    try {
      const result: SignatureActionResult =
        await removePersonnelSignatureAction({ personnelId });
      if (result.success) {
        onSignatureChanged(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Removal failed. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  }, [personnelId, onSignatureChanged]);

  return (
    <div
      className={`rounded-lg border bg-slate-50 p-4 transition-colors ${
        isDragOver
          ? "border-brand-primary bg-brand-primary/5"
          : "border-slate-200"
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <p className="text-xs font-semibold text-brand-text">Signature Image</p>
      <p className="mt-1 text-[11px] leading-relaxed text-brand-text-muted">
        PNG only, maximum 2 MB. Signature is used in completed laboratory reports.
      </p>

      {error && (
        <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {hasSignature ? (
          <>
            <div className="flex items-center gap-2 text-[11px] text-brand-text-subtle">
              <ImageOff className="h-3.5 w-3.5" />
              <span>Signature uploaded</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading || isRemoving}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1 h-3 w-3" />
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading || isRemoving}
                onClick={handleRemove}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Remove
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading || isRemoving}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1 h-3 w-3" />
            {isUploading ? "Uploading..." : "Upload Signature"}
          </Button>
        )}
      </div>
    </div>
  );
}
