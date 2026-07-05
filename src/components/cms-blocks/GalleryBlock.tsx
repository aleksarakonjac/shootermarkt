interface MediaDoc {
  id: number;
  url: string;
  alt: string;
}

export function GalleryBlock({ images }: { images: MediaDoc[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4">
      {images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={img.id} src={img.url} alt={img.alt} className="rounded-lg object-cover aspect-square" />
      ))}
    </div>
  );
}
