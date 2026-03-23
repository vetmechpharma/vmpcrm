import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { FileText, Download, Loader2, ExternalLink, BookOpen } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerDownloads = () => {
  const { customer } = useOutletContext();
  const [downloading, setDownloading] = useState(null);
  const [catalogues, setCatalogues] = useState([]);
  const [loadingCat, setLoadingCat] = useState(true);

  useEffect(() => {
    fetchCatalogues();
  }, []);

  const fetchCatalogues = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const res = await axios.get(`${API_URL}/api/catalogue-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCatalogues(res.data.catalogues || []);
    } catch { /* empty */ }
    finally { setLoadingCat(false); }
  };

  const downloadPriceList = async (mainCategory) => {
    const key = mainCategory || 'all';
    setDownloading(key);
    try {
      const token = localStorage.getItem('customerToken');
      const params = mainCategory ? { main_category: mainCategory } : {};
      const res = await axios.get(`${API_URL}/api/customer/pricelist/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pricelist_${(mainCategory || 'all').replace(/\s/g, '_').toLowerCase()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Price list downloaded');
    } catch { toast.error('Download failed'); }
    finally { setDownloading(null); }
  };

  const roleLabel = customer?.role === 'doctor' ? 'Doctor' : customer?.role === 'medical' ? 'Medical' : 'Agency';

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="customer-downloads">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Downloads</h1>
        <p className="text-slate-500 mt-1">Download price lists and catalogues</p>
      </div>

      {/* Price List Downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-emerald-600" />
            Price List ({roleLabel} Pricing)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">Download your personalized price list as PDF with your role-specific rates, offers, and special offers.</p>
          <div className="grid gap-3">
            {['Large Animals', 'Poultry', 'Pets'].map(cat => (
              <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border" data-testid={`pricelist-${cat.toLowerCase().replace(/\s/g, '-')}`}>
                <span className="font-medium text-slate-700">{cat}</span>
                <Button size="sm" onClick={() => downloadPriceList(cat)} disabled={downloading === cat}>
                  {downloading === cat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Download PDF
                </Button>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200" data-testid="pricelist-all">
              <span className="font-medium text-emerald-700">All Categories</span>
              <Button size="sm" onClick={() => downloadPriceList(null)} disabled={downloading === 'all'}>
                {downloading === 'all' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Download PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catalogue Downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Catalogues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCat ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : catalogues.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No catalogues available yet.</p>
          ) : (
            <div className="grid gap-3">
              {catalogues.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border" data-testid={`catalogue-${idx}`}>
                  <div>
                    <p className="font-medium text-slate-700">{cat.title}</p>
                    {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
                  </div>
                  <a href={cat.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {cat.url?.endsWith('.pdf') ? 'Download' : 'Open'}
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerDownloads;
