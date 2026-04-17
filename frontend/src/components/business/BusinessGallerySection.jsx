import { useEffect, useState } from 'react';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

export function BusinessGallerySection({ section }) {
  const images = section.items || [];
  const [activeIndex, setActiveIndex] = useState(0);
  const totalImages = images.length;
  const safeIndex = totalImages ? activeIndex % totalImages : 0;
  const activeImage = images[safeIndex];

  useEffect(() => {
    if (totalImages <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % totalImages);
    }, 4500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [totalImages]);

  function goToSlide(nextIndex) {
    setActiveIndex((nextIndex + totalImages) % totalImages);
  }

  if (!totalImages) {
    return null;
  }

  return (
    <Card className="section-card">
      <SectionHeader title={section.title} description={section.description} />
      <div className="gallery-carousel">
        <div className="gallery-carousel__frame">
          <figure key={activeImage.id} className="gallery-card gallery-card--active">
            <img src={activeImage.imageUrl} alt={activeImage.alt || section.title} loading="lazy" />
          </figure>

          {totalImages > 1 ? (
            <>
              <button
                type="button"
                className="carousel-nav carousel-nav--prev"
                aria-label="Imagem anterior"
                onClick={() => goToSlide(activeIndex - 1)}
              >
                {'<'}
              </button>
              <button
                type="button"
                className="carousel-nav carousel-nav--next"
                aria-label="Proxima imagem"
                onClick={() => goToSlide(activeIndex + 1)}
              >
                {'>'}
              </button>
            </>
          ) : null}
        </div>

        <div className="gallery-carousel__footer">
          <div className="gallery-carousel__meta">
            <strong>
              {activeIndex + 1}/{totalImages}
            </strong>
            <span>{activeImage.alt || section.title}</span>
          </div>

          {totalImages > 1 ? (
            <div className="carousel-dots" role="tablist" aria-label="Galeria de fotos">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  className={`carousel-dot ${index === activeIndex ? 'carousel-dot--active' : ''}`}
                  aria-label={`Ir para imagem ${index + 1}`}
                  aria-pressed={index === activeIndex}
                  onClick={() => goToSlide(index)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
