import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Tag, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function OffersCarousel({ role, className = '' }) {
  const [offers, setOffers] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const params = role ? `?role=${role}` : '';
    fetch(`${API_URL}/api/items/offers/active${params}`)
      .then(r => r.json())
      .then(data => setOffers(data || []))
      .catch(() => {});
  }, [role]);

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 260, behavior: 'smooth' });
    }
  };

  if (!offers.length) return null;

  return (
    <div className={className} data-testid="offers-carousel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1e7a4d' }}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">Current Offers</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{offers.length} products</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => scroll(-1)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" data-testid="offers-scroll-left">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => scroll(1)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" data-testid="offers-scroll-right">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {offers.map((item) => (
          <div key={item.id}
            className="flex-shrink-0 w-[240px] rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow"
            style={{ scrollSnapAlign: 'start' }}
            data-testid={`offer-card-${item.id}`}>
            {/* Image or placeholder */}
            {item.image_url ? (
              <div className="h-28 bg-slate-50 flex items-center justify-center overflow-hidden">
                <img src={`${API_URL}${item.image_url}`} alt={item.item_name} className="h-full w-full object-contain" loading="lazy" />
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' }}>
                <span className="text-3xl font-bold text-emerald-200">{item.item_name.charAt(0)}</span>
              </div>
            )}

            <div className="p-3">
              <p className="font-semibold text-sm text-slate-800 truncate">{item.item_name}</p>
              <p className="text-[11px] text-slate-400 mb-2">{item.item_code}</p>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-2">
                {item.rate > 0 && <span className="text-base font-bold" style={{ color: '#0c3c60' }}>₹{item.rate}</span>}
                {item.mrp > 0 && item.mrp !== item.rate && (
                  <span className="text-xs text-slate-400 line-through">₹{item.mrp}</span>
                )}
              </div>

              {/* Offer badges */}
              {item.offer && (
                <div className="flex items-start gap-1.5 mb-1.5">
                  <Tag className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs font-medium text-emerald-700 leading-tight">{item.offer}</p>
                </div>
              )}
              {item.special_offer && (
                <div className="flex items-start gap-1.5">
                  <Zap className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs font-medium text-amber-700 leading-tight">{item.special_offer}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
