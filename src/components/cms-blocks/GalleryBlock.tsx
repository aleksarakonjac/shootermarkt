import Image from "next/image";

interface MediaDoc {
  id: number;
  url: string;
  alt: string;
}

export function GalleryBlock({ images }: { images: MediaDoc[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4">
      {images.map((img) => (
        <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden">
          <Image src={img.url} alt={img.alt} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
        </div>
      ))}
    </div>
  );
}
