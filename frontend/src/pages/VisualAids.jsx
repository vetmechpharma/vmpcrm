import { useState, useEffect, useRef } from 'react';
import { visualAidAPI, itemsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Image, Layers, Upload, GripVertical,
  Edit2, Eye, ChevronLeft, ArrowUp, ArrowDown, FolderOpen
} from 'lucide-react';
import { formatDate } from '../lib/utils';

const DECK_TYPES = [
  { value: 'category', label: 'Category-wise' },
  { value: 'subcategory', label: 'Subcategory-wise' },
  { value: 'custom', label: 'Custom Deck' },
];

const MAIN_CATEGORIES = ['Large Animals', 'Poultry', 'Pets'];

export const VisualAids = () => {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState(null);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Deck detail view
  const [viewingDeck, setViewingDeck] = useState(null);
  const [deckSlides, setDeckSlides] = useState([]);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const [slideTitle, setSlideTitle] = useState('');
  const fileInputRef = useRef(null);

  const [subcategories, setSubcategories] = useState([]);

  const [deckForm, setDeckForm] = useState({
    name: '', deck_type: 'custom', category: '', subcategory: '', description: '', status: 'active',
  });

  useEffect(() => { fetchDecks(); fetchSubcategories(); }, []);

  const fetchDecks = async () => {
    setLoading(true);
    try {
      const res = await visualAidAPI.getDecks();
      setDecks(res.data);
    } catch { toast.error('Failed to fetch decks'); }
    finally { setLoading(false); }
  };

  const fetchSubcategories = async () => {
    try {
      const res = await itemsAPI.getCategories();
      setSubcategories(res.data?.subcategories || []);
    } catch { /* silent */ }
  };

  const openDeckDetail = async (deck) => {
    setViewingDeck(deck);
    setLoadingSlides(true);
    try {
      const res = await visualAidAPI.getDeck(deck.id);
      setDeckSlides(res.data.slides || []);
    } catch { toast.error('Failed to load slides'); }
    finally { setLoadingSlides(false); }
  };

  const closeDeckDetail = () => { setViewingDeck(null); setDeckSlides([]); };

  const openAddDeck = () => {
    setEditingDeck(null);
    setDeckForm({ name: '', deck_type: 'custom', category: '', subcategory: '', description: '', status: 'active' });
    setShowDeckModal(true);
  };

  const openEditDeck = (deck) => {
    setEditingDeck(deck);
    setDeckForm({
      name: deck.name, deck_type: deck.deck_type, category: deck.category || '',
      subcategory: deck.subcategory || '', description: deck.description || '', status: deck.status,
    });
    setShowDeckModal(true);
  };

  const saveDeck = async () => {
    if (!deckForm.name) { toast.error('Deck name is required'); return; }
    setFormLoading(true);
    try {
      if (editingDeck) {
        await visualAidAPI.updateDeck(editingDeck.id, deckForm);
        toast.success('Deck updated');
      } else {
        await visualAidAPI.createDeck(deckForm);
        toast.success('Deck created');
      }
      setShowDeckModal(false); fetchDecks();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save deck'); }
    finally { setFormLoading(false); }
  };

  const deleteDeck = async () => {
    if (!selectedDeck) return;
    setFormLoading(true);
    try {
      await visualAidAPI.deleteDeck(selectedDeck.id);
      toast.success('Deck deleted');
      setShowDeleteModal(false); setSelectedDeck(null); fetchDecks();
      if (viewingDeck?.id === selectedDeck.id) closeDeckDetail();
    } catch { toast.error('Failed to delete'); }
    finally { setFormLoading(false); }
  };

  // Slide management
  const handleSlideUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !viewingDeck) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setUploadingSlide(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        try {
          await visualAidAPI.addSlide(viewingDeck.id, {
            title: slideTitle || file.name.replace(/\.[^.]+$/, ''),
            image_base64: base64,
          });
          toast.success('Slide added');
          setSlideTitle('');
          // Refresh slides
          const res = await visualAidAPI.getDeck(viewingDeck.id);
          setDeckSlides(res.data.slides || []);
          fetchDecks(); // Update slide count
        } catch (err) { toast.error('Failed to upload slide'); }
        finally { setUploadingSlide(false); }
      };
      reader.readAsDataURL(file);
    } catch { setUploadingSlide(false); toast.error('Upload failed'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteSlide = async (slideId) => {
    if (!viewingDeck || !window.confirm('Delete this slide?')) return;
    try {
      await visualAidAPI.deleteSlide(viewingDeck.id, slideId);
      setDeckSlides(prev => prev.filter(s => s.id !== slideId));
      fetchDecks();
      toast.success('Slide deleted');
    } catch { toast.error('Failed to delete slide'); }
  };

  const moveSlide = async (index, direction) => {
    const newSlides = [...deckSlides];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newSlides.length) return;
    [newSlides[index], newSlides[swapIdx]] = [newSlides[swapIdx], newSlides[index]];
    setDeckSlides(newSlides);
    try {
      await visualAidAPI.reorderSlides(viewingDeck.id, newSlides.map(s => s.id));
    } catch { toast.error('Reorder failed'); }
  };

  const typeLabel = (t) => DECK_TYPES.find(d => d.value === t)?.label || t;
  const typeBg = (t) => ({ category: 'bg-blue-100 text-blue-700', subcategory: 'bg-purple-100 text-purple-700', custom: 'bg-amber-100 text-amber-700' }[t] || 'bg-slate-100');

  // Deck detail view
  if (viewingDeck) {
    return (
      <div className="space-y-4" data-testid="deck-detail-view">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={closeDeckDetail} className="gap-2"><ChevronLeft className="w-4 h-4" />Back</Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">{viewingDeck.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={typeBg(viewingDeck.deck_type)}>{typeLabel(viewingDeck.deck_type)}</Badge>
              {viewingDeck.category && <Badge variant="outline">{viewingDeck.category}</Badge>}
              {viewingDeck.subcategory && <Badge variant="outline">{viewingDeck.subcategory}</Badge>}
            </div>
          </div>
        </div>

        {/* Upload section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label>Slide Title (optional)</Label>
                <Input value={slideTitle} onChange={e => setSlideTitle(e.target.value)} placeholder="e.g., Product Overview" />
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSlideUpload} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploadingSlide} data-testid="upload-slide-btn">
                  {uploadingSlide ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Slide
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Slides grid */}
        {loadingSlides ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : deckSlides.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deckSlides.map((slide, idx) => (
              <Card key={slide.id} className="overflow-hidden" data-testid={`slide-${slide.id}`}>
                <div className="aspect-[4/3] bg-slate-100 relative">
                  {slide.image_webp ? (
                    <img src={`data:image/webp;base64,${slide.image_webp}`} alt={slide.title} className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400"><Image className="w-12 h-12" /></div>
                  )}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{idx + 1}</div>
                </div>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate flex-1">{slide.title || 'Untitled'}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => moveSlide(idx, 'up')} disabled={idx === 0} className="h-7 w-7 p-0"><ArrowUp className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => moveSlide(idx, 'down')} disabled={idx === deckSlides.length - 1} className="h-7 w-7 p-0"><ArrowDown className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteSlide(slide.id)} className="h-7 w-7 p-0 text-red-600"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Image className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600">No Slides Yet</h3>
            <p className="text-sm text-slate-400">Upload your first slide to build this presentation</p>
          </div>
        )}
      </div>
    );
  }

  // Deck list view
  return (
    <div className="space-y-6" data-testid="visual-aids-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Visual Aids</h1>
          <p className="text-slate-500">Manage presentation slide decks for MR visits</p>
        </div>
        <Button onClick={openAddDeck} data-testid="add-deck-btn"><Plus className="w-4 h-4 mr-2" />New Deck</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Decks', count: decks.length, color: 'bg-indigo-100', textColor: 'text-indigo-600' },
          { label: 'Category', count: decks.filter(d => d.deck_type === 'category').length, color: 'bg-blue-100', textColor: 'text-blue-600' },
          { label: 'Subcategory', count: decks.filter(d => d.deck_type === 'subcategory').length, color: 'bg-purple-100', textColor: 'text-purple-600' },
          { label: 'Custom', count: decks.filter(d => d.deck_type === 'custom').length, color: 'bg-amber-100', textColor: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-500">{s.label}</p><p className={`text-2xl font-bold ${s.textColor}`}>{s.count}</p></div>
              <div className={`w-10 h-10 ${s.color} rounded-full flex items-center justify-center`}><Layers className={`w-5 h-5 ${s.textColor}`} /></div>
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Deck List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : decks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map(deck => (
            <Card key={deck.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`deck-${deck.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1" onClick={() => openDeckDetail(deck)}>
                    <h3 className="font-semibold text-slate-800">{deck.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={typeBg(deck.deck_type)}>{typeLabel(deck.deck_type)}</Badge>
                      {deck.category && <Badge variant="outline" className="text-[10px]">{deck.category}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDeck(deck)} className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedDeck(deck); setShowDeleteModal(true); }} className="h-7 w-7 p-0 text-red-600"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
                {deck.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{deck.description}</p>}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t">
                  <span className="flex items-center gap-1"><Image className="w-3 h-3" />{deck.slide_count || 0} slides</span>
                  <span>{formatDate(deck.created_at)}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3 gap-2" onClick={() => openDeckDetail(deck)} data-testid={`open-deck-${deck.id}`}>
                  <FolderOpen className="w-3 h-3" />Open Deck
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600">No Visual Aid Decks</h3>
          <p className="text-sm text-slate-400">Create your first slide deck for MR presentations</p>
        </div>
      )}

      {/* Deck Form Modal */}
      <Dialog open={showDeckModal} onOpenChange={() => setShowDeckModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingDeck ? 'Edit Deck' : 'New Slide Deck'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Deck Name *</Label><Input value={deckForm.name} onChange={e => setDeckForm({...deckForm, name: e.target.value})} placeholder="e.g., Large Animal Products" data-testid="deck-name-input" /></div>
            <div className="space-y-2">
              <Label>Deck Type</Label>
              <Select value={deckForm.deck_type} onValueChange={v => setDeckForm({...deckForm, deck_type: v, category: '', subcategory: ''})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DECK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(deckForm.deck_type === 'category' || deckForm.deck_type === 'subcategory') && (
              <div className="space-y-2">
                <Label>Main Category</Label>
                <Select value={deckForm.category} onValueChange={v => setDeckForm({...deckForm, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{MAIN_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {deckForm.deck_type === 'subcategory' && (
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select value={deckForm.subcategory} onValueChange={v => setDeckForm({...deckForm, subcategory: v})}>
                  <SelectTrigger><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                  <SelectContent>{subcategories.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Description</Label><Textarea value={deckForm.description} onChange={e => setDeckForm({...deckForm, description: e.target.value})} placeholder="Brief description of this deck" rows={2} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={deckForm.status} onValueChange={v => setDeckForm({...deckForm, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeckModal(false)}>Cancel</Button>
            <Button onClick={saveDeck} disabled={formLoading} data-testid="save-deck-btn">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingDeck ? 'Update' : 'Create'} Deck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600">Delete Deck</DialogTitle></DialogHeader>
          <p className="py-4">Delete <strong>{selectedDeck?.name}</strong> and all its slides?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button onClick={deleteDeck} disabled={formLoading} className="bg-red-600 hover:bg-red-700">
              {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisualAids;
