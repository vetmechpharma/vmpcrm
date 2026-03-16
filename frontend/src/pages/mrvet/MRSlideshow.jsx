import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mrAPI } from '../../context/MRAuthContext';
import { Button } from '../../components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, X, Maximize, Minimize } from 'lucide-react';

export default function MRSlideshow() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    mrAPI.getVisualAidDeck(deckId)
      .then(res => { setDeck(res.data); setSlides(res.data.slides || []); })
      .catch(() => navigate('/mrvet/visual-aids'))
      .finally(() => setLoading(false));
  }, [deckId, navigate]);

  const goNext = useCallback(() => { setCurrentSlide(p => Math.min(p + 1, slides.length - 1)); }, [slides.length]);
  const goPrev = useCallback(() => { setCurrentSlide(p => Math.max(p - 1, 0)); }, []);

  // Keyboard and touch navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') { navigate('/mrvet/visual-aids'); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, navigate]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (loading) return <div className="flex justify-center items-center h-screen bg-black"><Loader2 className="w-10 h-10 animate-spin text-white/40" /></div>;

  if (!slides.length) return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <p className="text-lg mb-4">No slides in this deck</p>
      <Button variant="outline" onClick={() => navigate('/mrvet/visual-aids')}>Go Back</Button>
    </div>
  );

  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col select-none" data-testid="mr-slideshow"
      onTouchStart={(e) => { e.currentTarget._touchX = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const diff = (e.currentTarget._touchX || 0) - e.changedTouches[0].clientX;
        if (diff > 60) goNext();
        else if (diff < -60) goPrev();
      }}>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 gap-2"
          onClick={() => navigate('/mrvet/visual-aids')} data-testid="mr-slideshow-exit">
          <X className="w-4 h-4" />Exit
        </Button>
        <div className="text-center">
          <p className="text-white/90 text-sm font-medium">{deck?.name}</p>
          <p className="text-white/50 text-xs">{slide?.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm">{currentSlide + 1} / {slides.length}</span>
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Slide */}
      <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-20">
        {slide?.image_webp ? (
          <img src={`data:image/webp;base64,${slide.image_webp}`} alt={slide.title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" draggable={false} />
        ) : (
          <div className="text-white/40 text-lg">No image</div>
        )}
      </div>

      {/* Navigation */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-4 bg-gradient-to-t from-black/70 to-transparent">
        <Button variant="ghost" size="lg" className="text-white/80 hover:text-white hover:bg-white/10"
          disabled={currentSlide === 0} onClick={goPrev} data-testid="mr-slideshow-prev">
          <ChevronLeft className="w-6 h-6" />
        </Button>

        {/* Slide indicators */}
        <div className="flex gap-1.5 overflow-x-auto max-w-[60%] py-1">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all shrink-0 ${i === currentSlide ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`} />
          ))}
        </div>

        <Button variant="ghost" size="lg" className="text-white/80 hover:text-white hover:bg-white/10"
          disabled={currentSlide === slides.length - 1} onClick={goNext} data-testid="mr-slideshow-next">
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div className="h-full transition-all duration-300" style={{ width: `${((currentSlide + 1) / slides.length) * 100}%`, background: '#3b82f6' }} />
      </div>
    </div>
  );
}
