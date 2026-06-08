// app/_components/communications/AttachmentUploader.tsx

import type { AttachmentFile } from "@/lib/types/communications";
import { Paperclip, X } from "lucide-react";
import { useCallback, useRef } from "react";

interface Props {
  attachments: AttachmentFile[];
  onChange: (v: AttachmentFile[]) => void;
}

export function AttachmentUploader({ attachments, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const toAdd: AttachmentFile[] = [];
      for (const file of Array.from(files)) {
        if (attachments.length + toAdd.length >= 5) break;
        if (file.size > 5 * 1024 * 1024) continue;
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1] ?? "");
          r.readAsDataURL(file);
        });
        toAdd.push({ file, name: file.name, size: file.size, base64 });
      }
      onChange([...attachments, ...toAdd]);
    },
    [attachments, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={attachments.length >= 5}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-white/35 hover:text-white/65 hover:border-white/[0.14] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach file
        </button>
        <span className="text-[10px] text-white/15">
          Max 5 MB · {attachments.length}/5
        </span>
        <input
          aria-label="file"
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] px-2.5 py-1"
            >
              <Paperclip className="h-3 w-3 text-white/25" />
              <span className="text-xs text-white/50 max-w-[140px] truncate">
                {a.name}
              </span>
              <span className="text-[10px] text-white/20">
                {(a.size / 1024).toFixed(0)}KB
              </span>
              <button
                aria-label="remove"
                type="button"
                onClick={() =>
                  onChange(attachments.filter((x) => x.name !== a.name))
                }
                className="text-white/20 hover:text-rose-400 transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}