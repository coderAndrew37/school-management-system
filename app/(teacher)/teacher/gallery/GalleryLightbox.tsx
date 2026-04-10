import Image from "next/image";

interface Props {
  src: string;
  onClose: () => void;
}

export function GalleryLightbox({ src, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        aria-label="close lightbox"
        className="absolute top-4 right-4 text-white/60 hover:text-white p-2"
        onClick={onClose}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <Image
        src={src}
        alt=""
        className="max-w-full max-h-[90vh] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}