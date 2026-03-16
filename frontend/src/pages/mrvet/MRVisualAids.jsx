import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mrAPI } from '../../context/MRAuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, Layers, Image, Play } from 'lucide-react';

export default function MRVisualAids() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    mrAPI.getVisualAids()
      .then(res => setDecks(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const typeLabel = (t) => ({ category: 'Category', subcategory: 'Subcategory', custom: 'Custom' }[t] || t);
  const typeBg = (t) => ({ category: 'bg-blue-100 text-blue-700', subcategory: 'bg-purple-100 text-purple-700', custom: 'bg-amber-100 text-amber-700' }[t] || 'bg-slate-100');

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4" data-testid="mr-visual-aids-page">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Visual Aids</h1>
        <p className="text-sm text-slate-500">Select a deck to start your presentation</p>
      </div>

      {decks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map(d => (
            <Card key={d.id} className="hover:shadow-md transition-shadow" data-testid={`mr-deck-${d.id}`}>
              <CardContent className="pt-5 pb-5">
                <div className="mb-3">
                  <h3 className="font-semibold text-slate-800">{d.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={typeBg(d.deck_type)}>{typeLabel(d.deck_type)}</Badge>
                    {d.category && <Badge variant="outline" className="text-[10px]">{d.category}</Badge>}
                    {d.subcategory && <Badge variant="outline" className="text-[10px]">{d.subcategory}</Badge>}
                  </div>
                </div>
                {d.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{d.description}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Image className="w-3 h-3" />{d.slide_count || 0} slides</span>
                  <Button size="sm" disabled={!d.slide_count} onClick={() => navigate(`/mrvet/slideshow/${d.id}`)}
                    style={{ background: '#1e3a5f' }} data-testid={`mr-start-deck-${d.id}`}>
                    <Play className="w-3 h-3 mr-1.5" />Present
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No visual aid decks available</p>
          <p className="text-xs text-slate-400 mt-1">Contact admin to add presentation decks</p>
        </div>
      )}
    </div>
  );
}
