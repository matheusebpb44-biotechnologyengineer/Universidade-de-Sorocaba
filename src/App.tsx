import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import axios from 'axios';
import { 
  MapPin, AlertTriangle, LightbulbOff, Trash2, PlusCircle, X, Search, CheckCircle, 
  Leaf, ShieldAlert, HeartHandshake, PawPrint, History, BarChart3, Layers, Map as MapIcon,
  Clock, Activity, ThumbsUp, MessageSquare, AlertOctagon, Send
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet.heat';

// Types
export interface Comment {
  id: number;
  texto: string;
  autorCpf: string;
  createdAt: string;
}

export interface Occurrence {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  latitude: number;
  longitude: number;
  cpf: string;
  protocolo: string;
  resolvido: boolean;
  status: string;
  prioridade: string;
  likes: number;
  resolvedAt?: string;
  createdAt: string;
  comments?: Comment[];
}

// Categorias Grouped
const THEME_GROUPS: Record<string, string[]> = {
  'Meio Ambiente e Saúde': [
    'Focos de Dengue', 'Enchentes e alagamentos', 'Desmatamento/corte irregular de árvores', 
    'Poluição sonora', 'Poluição do ar', 'Poluição visual', 'Acúmulo de água parada'
  ],
  'Infraestrutura Urbana': [
    'Buracos na via', 'Pavimentação danificada/calçadas', 'Sinalização danificada/ausente',
    'Semáforos com defeito', 'Problemas estruturais em pontes', 'Falta de acessibilidade'
  ],
  'Serviços Públicos': [
    'Iluminação: Lâmpada apagada', 'Iluminação: Lâmpada piscando', 'Lixo irregular',
    'Falta de coleta de lixo', 'Falta de varrição/limpeza', 'Problemas em pontos de ônibus',
    'Falta de transporte público'
  ],
  'Animais': [
    'Maus-tratos de animais', 'Animais abandonados', 'Animais mortos', 'Infestação de pragas urbanas'
  ],
  'Segurança e Ordem': [
    'Ponto de venda de drogas', 'Consumo de drogas no local', 'Vandalismo/depredação',
    'Ocupação irregular', 'Estacionamento irregular'
  ],
  'Assistência Social': [
    'Pessoas em situação de rua', 'Crianças em situação de risco', 'Idosos abandonados/risco'
  ]
};

// Theme configurations for map pins and UI
const THEMES: Record<string, { color: string, bg: string, text: string, icon: React.ElementType }> = {
  'Meio Ambiente e Saúde': { color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Leaf },
  'Infraestrutura Urbana': { color: '#f97316', bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
  'Serviços Públicos': { color: '#eab308', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: LightbulbOff },
  'Animais': { color: '#8b5cf6', bg: 'bg-purple-100', text: 'text-purple-700', icon: PawPrint },
  'Segurança e Ordem': { color: '#ef4444', bg: 'bg-red-100', text: 'text-red-700', icon: ShieldAlert },
  'Assistência Social': { color: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700', icon: HeartHandshake },
};

// Map old and current subcategories to their respective themes
const getThemeForCategory = (categoryName: string) => {
  for (const [theme, subcategories] of Object.entries(THEME_GROUPS)) {
    if (subcategories.includes(categoryName)) return theme;
  }
  
  // Handling old categories that might be in the database
  if (categoryName.toLowerCase().includes('dengue') || categoryName.toLowerCase().includes('meio ambiente')) return 'Meio Ambiente e Saúde';
  if (categoryName.toLowerCase().includes('buraco') || categoryName.toLowerCase().includes('via')) return 'Infraestrutura Urbana';
  if (categoryName.toLowerCase().includes('iluminação') || categoryName.toLowerCase().includes('lixo')) return 'Serviços Públicos';
  
  // Defalt fallback
  return 'Infraestrutura Urbana'; 
};

// Fix for default Leaflet icons in React
const categoryIcon = (categoryName: string, resolvido: boolean = false, prioridade: string = 'Normal') => {
  const themeName = getThemeForCategory(categoryName);
  let color = THEMES[themeName]?.color || '#6b7280';
  if (resolvido) {
    color = '#94a3b8'; // gray-400 for resolved
  }
  
  const shadowClasses = prioridade === 'Crítica' && !resolvido ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : '';
  
  const strokeColor = prioridade === 'Crítica' && !resolvido ? '#ef4444' : color;

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${shadowClasses}" style="fill: ${color}; fill-opacity: 0.2;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

  return L.divIcon({
    className: 'custom-icon',
    html: prioridade === 'Crítica' && !resolvido ? `<div class="animate-pulse">${svgIcon}</div>` : svgIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

function MapClickHandler({ onClick }: { onClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0 || !(L as any).heatLayer) return;
    const heat = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 15,
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);
  return null;
}

export default function App() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<L.LatLng | null>(null);
  
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successProtocol, setSuccessProtocol] = useState('');
  
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [searchProtocol, setSearchProtocol] = useState('');
  const [searchResult, setSearchResult] = useState<Occurrence | null>(null);
  const [searchError, setSearchError] = useState('');

  const [mapMode, setMapMode] = useState<'pins' | 'heatmap'>('pins');
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyCpf, setHistoryCpf] = useState('');
  const [historyResults, setHistoryResults] = useState<Occurrence[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  // Form State
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Focos de Dengue');
  const [prioridade, setPrioridade] = useState('Normal');
  const [cpf, setCpf] = useState('');
  
  const [newComment, setNewComment] = useState('');
  const [commentCpf, setCommentCpf] = useState('');

  const [cpfPromptConfig, setCpfPromptConfig] = useState<{isOpen: boolean, message: string, action: ((cpf: string) => void) | null}>({ isOpen: false, message: '', action: null });
  const [promptCpf, setPromptCpf] = useState('');

  // Load occurrences
  useEffect(() => {
    fetchOccurrences();
  }, []);

  const fetchOccurrences = async () => {
    try {
      const response = await axios.get('/api/occurrences');
      setOccurrences(response.data);
    } catch (error) {
      console.error('Error fetching occurrences:', error);
    }
  };

  const handleMapClick = (latlng: L.LatLng) => {
    setSelectedLocation(latlng);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;

    try {
      const newOccurrence = {
        titulo,
        descricao,
        categoria,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        cpf,
        prioridade
      };

      const response = await axios.post('/api/occurrences', newOccurrence);
      
      // Reset form and close modal
      setTitulo('');
      setDescricao('');
      setCpf('');
      setCategoria('Focos de Dengue');
      setPrioridade('Normal');
      setIsModalOpen(false);
      setSelectedLocation(null);
      
      // Show success protocol
      setSuccessProtocol(response.data.protocolo);
      setIsSuccessModalOpen(true);
      
      // Refresh list
      fetchOccurrences();
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Erro ao registrar ocorrência. Tente novamente.');
    }
  };

  const handleSearchProtocol = async () => {
    if (!searchProtocol.trim()) return;
    try {
      // We will refetch single occurrences to get latest comments/likes if we want, or just fetch all and find
      await fetchOccurrences(); // refresh memory
    } catch(e) {}
    
    // Check locally after refresh
    // Need to use state from previous line but setOccurrences is async, let's just find in the current state then replace if found
    const found = occurrences.find(o => o.protocolo === searchProtocol.trim());
    if (found) {
      setSearchResult(found);
      setSearchError('');
    } else {
      setSearchResult(null);
      setSearchError('Protocolo não encontrado.');
    }
  };

  const handleLike = (id: number) => {
    setCpfPromptConfig({
      isOpen: true,
      message: 'Para apoiar esta queixa, é obrigatório informar seu CPF:',
      action: async (cpf) => {
        try {
          await axios.put(`/api/occurrences/${id}/like`, { cpf });
          await fetchOccurrences();
          if (searchResult && searchResult.id === id) {
             setSearchResult(prev => prev ? { ...prev, likes: prev.likes + 1 } : null);
          }
        } catch (error: any) {
          console.error(error);
          alert(error.response?.data?.error || 'Erro ao apoiar ocorrência.');
        }
      }
    });
  };

  const handleAddComment = async (id: number) => {
    if (!newComment.trim()) return;
    if (!commentCpf.trim()) {
      alert('O seu CPF é obrigatório para poder comentar.');
      return;
    }
    try {
      await axios.post(`/api/occurrences/${id}/comments`, {
        texto: newComment,
        autorCpf: commentCpf
      });
      setNewComment('');
      
      // refresh
      await fetchOccurrences();
      // Update local searchResult if opened
      if (searchResult && searchResult.id === id) {
         const occRes = await axios.get('/api/occurrences');
         const updatedOcc = occRes.data.find((o: any) => o.id === id);
         if (updatedOcc) setSearchResult(updatedOcc);
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar comentário.');
    }
  };

  const handleFetchHistory = async () => {
    if (!historyCpf.trim()) return;
    setHistoryLoading(true);
    try {
      const response = await axios.get(`/api/occurrences/history/${historyCpf.trim()}`);
      setHistoryResults(response.data);
    } catch(err) {
      console.error(err);
      alert('Erro ao buscar histórico.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!searchResult) return;
    try {
      await axios.put(`/api/occurrences/resolve/${searchResult.protocolo}`);
      // Refresh occurrences and current search
      await fetchOccurrences();
      setSearchResult({ ...searchResult, resolvido: true });
      alert('Ocorrência marcada como revolvida com sucesso!');
    } catch (error) {
      console.error('Error resolving:', error);
      alert('Erro ao resolver ocorrência.');
    }
  };

  const handleExportTXT = () => {
    // Filter unresolved occurrences
    const unresolvedOccurrences = occurrences.filter(occ => !occ.resolvido);
    
    let txtContent = 'Relatório de Demandas - Cidadão Conectado\n';
    txtContent += 'Projeto de extensão UNISO - ENGENHARIA: TECNOLOGIA E DESAFIOS\n\n';
    txtContent += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    txtContent += '==================================================\n\n';
    
    unresolvedOccurrences.forEach(occ => {
      txtContent += `Protocolo: ${occ.protocolo}\n`;
      txtContent += `Título: ${occ.titulo}\n`;
      txtContent += `Categoria: ${occ.categoria}\n`;
      txtContent += `Descrição: ${occ.descricao}\n`;
      txtContent += `Data de Criação: ${new Date(occ.createdAt).toLocaleString('pt-BR')}\n`;
      txtContent += `Tempo em aberto: ${Math.floor((Date.now() - new Date(occ.createdAt).getTime()) / (1000 * 60 * 60 * 24))} dias\n`;
      txtContent += `CPF do Relator: ${occ.cpf || 'Não informado'}\n`;
      txtContent += `Status: ${occ.status || (occ.resolvido ? 'Resolvido' : 'Em Análise')}\n`;
      txtContent += `--------------------------------------------------\n\n`;
    });
    
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio-demandas.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Sorocaba - SP coordinates
  const defaultCenter: [number, number] = [-23.5015, -47.4581];

  // Stats calculate
  const totalOccurrences = occurrences.length;
  const resolvedCount = occurrences.filter(o => o.resolvido).length;
  const inAnalysisCount = occurrences.filter(o => o.status === 'Em Análise' && !o.resolvido).length;
  const inProgressCount = occurrences.filter(o => o.status === 'Em Andamento' && !o.resolvido).length;
  
  let avgResolutionTimeMs = 0;
  const resolvedWithTime = occurrences.filter(o => o.resolvido && o.resolvedAt);
  if (resolvedWithTime.length > 0) {
    const totalMs = resolvedWithTime.reduce((acc, curr) => {
      return acc + (new Date(curr.resolvedAt!).getTime() - new Date(curr.createdAt).getTime());
    }, 0);
    avgResolutionTimeMs = totalMs / resolvedWithTime.length;
  }
  const avgResolutionDays = avgResolutionTimeMs > 0 ? (avgResolutionTimeMs / (1000 * 60 * 60 * 24)).toFixed(1) : 'N/A';

  const heatmapPoints: [number, number, number][] = occurrences.map(o => [o.latitude, o.longitude, o.resolvido ? 0.2 : 1]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="py-3 bg-white border-b border-slate-200 px-6 flex items-center justify-center flex-shrink-0">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">Cidadão Conectado</h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase hidden sm:block">Zeladoria e Saúde Urbana • ODS 3 & 11</p>
              <p className="text-[10px] text-blue-600 font-bold tracking-wide uppercase hidden sm:block mt-0.5">Projeto de extensão UNISO - ENGENHARIA: TECNOLOGIA E DESAFIOS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto custom-scroll pb-1">
            <button 
              onClick={() => setIsStatsModalOpen(true)}
              className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-purple-200 shrink-0"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Estatísticas</span>
            </button>
            <button 
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-emerald-200 shrink-0"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Meu Histórico</span>
            </button>
            <button 
              onClick={() => setIsConsultModalOpen(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-200 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Consultar Protocolo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
        
        {/* Map Section */}
        <div className="w-full md:w-2/3 flex flex-col gap-3 shrink-0">
          <div className="bg-white p-2 rounded-xl flex items-center justify-between border border-slate-200 shadow-sm shrink-0">
            <h2 className="text-sm font-bold text-slate-800 px-2 flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-slate-400" /> Vista do Mapa
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setMapMode('pins')}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${mapMode === 'pins' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pinos
              </button>
              <button 
                onClick={() => setMapMode('heatmap')}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${mapMode === 'heatmap' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Mapa de Calor
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-[50vh] md:min-h-0 rounded-xl border-2 border-slate-300 shadow-inner overflow-hidden relative">
            <MapContainer 
              center={defaultCenter} 
              zoom={12} 
              className="w-full h-full z-0"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapClickHandler onClick={handleMapClick} />

              {mapMode === 'pins' && occurrences.map((occ) => (
                <Marker 
                  key={occ.id} 
                  position={[occ.latitude, occ.longitude]}
                  icon={categoryIcon(occ.categoria, occ.resolvido, occ.prioridade)}
                >
                  <Popup className="rounded-lg shadow-sm">
                    <div className="p-1 min-w-[200px]">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className={`font-semibold text-sm ${occ.resolvido ? 'text-slate-500 line-through' : 'text-gray-900'}`}>{occ.titulo}</div>
                        {occ.resolvido && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                      </div>
                      <div className="flex gap-1 flex-wrap mt-1 mb-2">
                        <span className={`inline-block px-2 py-0.5 bg-slate-100 text-[10px] font-bold rounded text-slate-700 uppercase`}>
                          {occ.status || 'Em Análise'}
                        </span>
                        {occ.prioridade === 'Crítica' && !occ.resolvido && (
                          <span className="inline-block px-2 py-0.5 bg-red-100 text-[10px] font-bold rounded text-red-700 uppercase">
                            Crítica
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{occ.descricao}</p>
                      
                      <div className="flex items-center gap-3 border-t border-slate-100 pt-2 mb-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleLike(occ.id); }} 
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Apoiar ({occ.likes})
                        </button>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          <MessageSquare className="w-3.5 h-3.5" /> {occ.comments?.length || 0}
                        </div>
                      </div>

                      <div className="text-xs text-gray-400">
                        Criado: {new Date(occ.createdAt).toLocaleDateString('pt-BR')} 
                        {occ.resolvido && occ.resolvedAt && (
                          <span className="block mt-0.5 text-emerald-600">Resolvido: {new Date(occ.resolvedAt).toLocaleDateString('pt-BR')}</span>
                        )}
                        <span className="block mt-2 font-mono text-[10px] bg-slate-50 py-1 px-2 rounded font-bold text-slate-500">Protocolo: {occ.protocolo}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {mapMode === 'heatmap' && <HeatmapLayer points={heatmapPoints} />}
            </MapContainer>
            
            <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur px-4 py-3 rounded-lg border border-slate-200 shadow-sm hidden sm:block">
              <h3 className="text-[10px] font-bold text-slate-900 mb-2 uppercase tracking-wider">Legenda de Cores</h3>
              <div className="space-y-2 text-[10px] font-bold uppercase text-slate-700">
                {Object.entries(THEMES).map(([themeName, info]) => {
                  const Icon = info.icon;
                  return (
                    <div key={themeName} className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: info.color }} />
                      <span className="text-gray-700">{themeName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Instructions overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] bg-gray-900/80 backdrop-blur text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-none text-center min-w-max">
              <PlusCircle className="w-4 h-4" />
              Clique no mapa para registrar
            </div>
          </div>
        </div>

        {/* Dashboard / Report Section */}
        <div className="w-full md:w-1/3 flex flex-col h-[50vh] md:h-[calc(100vh-140px)]">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0 gap-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Relatório</h3>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportTXT}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline uppercase bg-blue-50 px-2 py-1 rounded transition-colors border border-blue-100"
                >
                  Exportar TXT
                </button>
                <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider hidden lg:inline-block">
                  {occurrences.length} {occurrences.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
              {occurrences.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p>Nenhuma ocorrência registrada.</p>
                  <p className="text-sm mt-1">Clique no mapa para começar.</p>
                </div>
              ) : (
                occurrences.map((occ) => {
                  const themeName = getThemeForCategory(occ.categoria);
                  const themeInfo = THEMES[themeName];
                  const Icon = themeInfo?.icon || MapPin;
                  
                  return (
                    <div key={occ.id} className={`bg-white border text-left border-slate-100 rounded-lg p-4 hover:bg-slate-50/50 transition-colors ${occ.resolvido ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-medium ${occ.resolvido ? 'text-slate-500 line-through' : 'text-slate-800'} line-clamp-1`}>{occ.titulo}</h4>
                          {occ.resolvido && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                        </div>
                        <Icon className="w-5 h-5 shrink-0 ml-2" style={{ color: themeInfo?.color }} />
                      </div>
                      
                      <div className="flex gap-2 items-center mb-2">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase text-center rounded-full ${themeInfo?.bg} ${themeInfo?.text} max-w-[150px] truncate shrink-0`}>
                          {occ.categoria}
                        </span>
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${
                          occ.resolvido ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
                          occ.status === 'Em Andamento' ? 'border-blue-200 text-blue-600 bg-blue-50' :
                          'border-slate-200 text-slate-500 bg-slate-50'
                        }`}>
                          {occ.status || 'Em Análise'}
                        </span>
                        {occ.prioridade === 'Crítica' && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border border-red-200 text-red-600 bg-red-50 shrink-0">
                            Crítica
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{occ.descricao}</p>
                      
                      <div className="flex items-center gap-3 border-t border-slate-50 pt-2 mb-2">
                        <button onClick={() => handleLike(occ.id)} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors">
                          <ThumbsUp className="w-3 h-3" /> Apoiar ({occ.likes})
                        </button>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <MessageSquare className="w-3 h-3" /> {occ.comments?.length || 0}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[10px] font-medium text-slate-400 shrink-0 ml-2">
                          {new Date(occ.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal / Form overlay */}
      {isModalOpen && selectedLocation && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
              <h2 className="text-sm font-bold uppercase tracking-wider">Nova Ocorrência</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:text-slate-200 transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="cpf" className="block text-xs font-bold text-slate-500 uppercase">
                    Seu CPF
                  </label>
                  <input
                    type="text"
                    id="cpf"
                    required
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Somente números"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="titulo" className="block text-xs font-bold text-slate-500 uppercase">
                    Título
                  </label>
                  <input
                    type="text"
                    id="titulo"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Buraco na Av. Central"
                  />
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="categoria" className="block text-xs font-bold text-slate-500 uppercase">
                    Categoria
                  </label>
                  <select
                    id="categoria"
                    required
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-48"
                  >
                    {Object.entries(THEME_GROUPS).map(([theme, items]) => (
                      <optgroup key={theme} label={theme}>
                        {items.map(item => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="prioridade" className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Prioridade <AlertOctagon className="w-3 h-3" />
                  </label>
                  <select
                    id="prioridade"
                    required
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica (Risco iminente)</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="descricao" className="block text-xs font-bold text-slate-500 uppercase">
                    Descrição
                  </label>
                  <textarea
                    id="descricao"
                    required
                    rows={3}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Detalhes do problema..."
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Latitude</label>
                    <input type="text" readOnly value={selectedLocation.lat.toFixed(6)} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-500 cursor-not-allowed" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Longitude</label>
                    <input type="text" readOnly value={selectedLocation.lng.toFixed(6)} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-md transition-colors text-sm shadow-sm"
                >
                  Registrar no Mapa
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-md transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSuccessModalOpen(false)}></div>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden relative z-10 animate-in fade-in zoom-in p-6 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Ocorrência Registrada!</h2>
            <p className="text-sm text-slate-600 mb-4">Guarde o seu número de protocolo para realizar consultas ou informar que o problema foi resolvido:</p>
            <div className="bg-slate-100 rounded-lg py-3 px-4 mb-6">
              <span className="text-2xl font-mono font-bold text-blue-700 tracking-wider flex justify-center">{successProtocol}</span>
            </div>
            <button 
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-md transition-colors text-sm"
            >
              Concluído
            </button>
          </div>
        </div>
      )}

      {/* Consult Protocol Modal */}
      {isConsultModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
            setIsConsultModalOpen(false);
            setSearchResult(null);
            setSearchError('');
            setSearchProtocol('');
          }}></div>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden relative z-10 animate-in fade-in zoom-in flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-wider">Consultar Protocolo</h2>
              <button 
                onClick={() => {
                  setIsConsultModalOpen(false);
                  setSearchResult(null);
                  setSearchError('');
                  setSearchProtocol('');
                }}
                className="text-slate-300 hover:text-white transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  placeholder="EX: A1B2C3D4"
                  value={searchProtocol}
                  onChange={e => setSearchProtocol(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handleSearchProtocol}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-bold text-sm transition-colors"
                  type="button"
                >
                  Buscar
                </button>
              </div>

              {searchError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 font-medium mb-4">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800">{searchResult.titulo}</h4>
                      <p className="text-xs text-slate-500 mb-1">{searchResult.categoria}</p>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Status atual:</span>
                    </div>
                    {searchResult.resolvido ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Resolvido
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                        {searchResult.status || 'Pendente'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{searchResult.descricao}</p>
                  
                  {!searchResult.resolvido && (
                    <div className="pt-4 border-t border-slate-200 mt-4">
                      <p className="text-xs text-slate-500 mb-3">Este problema já foi solucionado pela prefeitura ou equipe responsável?</p>
                      <button 
                        onClick={handleResolve}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-md transition-colors text-sm flex justify-center items-center gap-2"
                        type="button"
                      >
                        <CheckCircle className="w-4 h-4" /> Marcar como Resolvido
                      </button>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200 mt-4">
                    <h5 className="text-xs font-bold uppercase text-slate-500 mb-3">Comentários ({searchResult.comments?.length || 0})</h5>
                    
                    <div className="space-y-3 mb-4 max-h-40 overflow-y-auto custom-scroll pr-2">
                       {searchResult.comments?.map(c => (
                         <div key={c.id} className="bg-white p-3 rounded-md border border-slate-100 shadow-sm">
                           <p className="text-sm text-slate-700">{c.texto}</p>
                           <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400 font-medium uppercase truncate">
                             <span className="truncate">Cidadão: {c.autorCpf || 'Anônimo'}</span>
                             <span className="shrink-0">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                           </div>
                         </div>
                       ))}
                       {(!searchResult.comments || searchResult.comments.length === 0) && (
                         <p className="text-xs text-slate-400 text-center italic">Nenhum comentário ainda.</p>
                       )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        placeholder="Seu CPF (obrigatório para comentar)"
                        value={commentCpf}
                        onChange={e => setCommentCpf(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Adicionar comentário..."
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                          onClick={() => handleAddComment(searchResult.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                          disabled={!newComment.trim()}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsStatsModalOpen(false)}></div>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden relative z-10 animate-in fade-in zoom-in flex flex-col max-h-[90vh]">
            <div className="bg-purple-700 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-5 h-5"/> Estatísticas Públicas
              </h2>
              <button 
                onClick={() => setIsStatsModalOpen(false)}
                className="text-purple-200 hover:text-white transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1 text-center">
                  <div className="text-3xl font-bold text-slate-800">{totalOccurrences}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 mt-1 line-clamp-2 leading-tight">Total Registrado</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div className="text-3xl font-bold text-amber-500">{inAnalysisCount}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Em Análise</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div className="text-3xl font-bold text-blue-500">{inProgressCount}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Em Andamento</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                  <div className="text-3xl font-bold text-emerald-500">{resolvedCount}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Resolvidas</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6 flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600 shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Tempo Médio de Resolução</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Média geral baseada no histórico de queixas concluídas.</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-2xl font-bold text-blue-600">{avgResolutionDays}</div>
                  <div className="text-[10px] font-bold text-blue-400 uppercase">Dias úteis</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
            setIsHistoryModalOpen(false);
            setHistoryResults(null);
            setHistoryCpf('');
          }}></div>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden relative z-10 animate-in fade-in zoom-in flex flex-col max-h-[90vh]">
            <div className="bg-emerald-700 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <History className="w-5 h-5"/> Meu Histórico
              </h2>
              <button 
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setHistoryResults(null);
                  setHistoryCpf('');
                }}
                className="text-emerald-200 hover:text-white transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scroll">
              <p className="text-sm text-slate-600 mb-4 font-medium">Consulte e gerencie todas as queixas atreladas ao seu CPF.</p>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder="Seu CPF (Ex: 12345678900)"
                  value={historyCpf}
                  onChange={e => setHistoryCpf(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button 
                  onClick={handleFetchHistory}
                  disabled={historyLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-bold text-sm transition-colors disabled:opacity-50"
                  type="button"
                >
                  {historyLoading ? 'Buscando...' : 'Pesquisar'}
                </button>
              </div>

              {historyResults && historyResults.length === 0 && (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                  <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2"/>
                  Nenhum registro encontrado para este CPF.
                </div>
              )}

              {historyResults && historyResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Seus Registros Encontrados ({historyResults.length}):</h3>
                  {historyResults.map(res => (
                    <div key={res.id} className="bg-white border text-left border-slate-200 shadow-sm rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{res.titulo}</h4>
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border shrink-0 ${
                          res.resolvido ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
                          res.status === 'Em Andamento' ? 'border-blue-200 text-blue-600 bg-blue-50' :
                          'border-slate-200 text-slate-500 bg-slate-50'
                        }`}>
                          {res.resolvido ? 'Resolvido' : (res.status || 'Em Análise')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2 line-clamp-2">{res.descricao}</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                        <span className="font-mono bg-slate-100 text-slate-500 px-1 py-0.5 rounded">Prot: {res.protocolo}</span>
                        <span>{new Date(res.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cpf Prompt Modal */}
      {cpfPromptConfig.isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCpfPromptConfig({ ...cpfPromptConfig, isOpen: false })}></div>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden relative z-10 animate-in fade-in zoom-in">
            <div className="p-6">
              <h3 className="font-bold text-slate-800 mb-2 text-lg">Confirmação Necessária</h3>
              <p className="text-sm text-slate-600 mb-4">{cpfPromptConfig.message}</p>
              
              <input 
                type="text" 
                placeholder="Seu CPF (só números)"
                value={promptCpf}
                onChange={e => setPromptCpf(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setCpfPromptConfig({ ...cpfPromptConfig, isOpen: false })}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (!promptCpf.trim()) {
                      alert('O CPF é obrigatório para continuar.');
                      return;
                    }
                    if (cpfPromptConfig.action) {
                      cpfPromptConfig.action(promptCpf.trim());
                    }
                    setCpfPromptConfig({ isOpen: false, message: '', action: null });
                    setPromptCpf('');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-bold transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
