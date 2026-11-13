import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { imageUrl, photos as portfolioPhotos } from "@/data/studio";
import Dialog from "@/components/landing/Dialog";

/** Dark tokens belong to this viewer, never to the route or document. */
export default function GalleryViewer({ index, onChange, onClose, photos = portfolioPhotos }) {
  const [failed, setFailed] = useState({});
  function move(direction) {
    onChange((current) => (current + direction + photos.length) % photos.length);
  }
  return (
    <Dialog
      title={photos[index].title}
      className="photo-dialog"
      theme="dark"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      {failed[photos[index].id] ? <p role="status">Sample photograph unavailable.</p> : <img
        src={imageUrl(photos[index], 1600)}
        alt={photos[index].alt}
        onError={() => setFailed(value => ({ ...value, [photos[index].id]: true }))}
      />}
      <div className="lightbox-controls">
        <button className="studio-button secondary" onClick={() => move(-1)}>
          <ChevronLeft size={17} /> Previous
        </button>
        <span aria-live="polite">{index + 1} / {photos.length}</span>
        <button className="studio-button secondary" onClick={() => move(1)}>
          Next <ChevronRight size={17} />
        </button>
      </div>
    </Dialog>
  );
}
