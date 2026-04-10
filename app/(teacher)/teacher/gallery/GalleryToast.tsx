interface Props {
  msg: string;
  ok: boolean;
}

export function GalleryToast({ msg, ok }: Props) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
        ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
      }`}
    >
      {msg}
    </div>
  );
}