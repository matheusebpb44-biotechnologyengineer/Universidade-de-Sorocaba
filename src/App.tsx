import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import { MapPin, AlertTriangle, LightbulbOff, Trash2, PlusCircle, X, Search, CheckCircle, Leaf, ShieldAlert, HeartHandshake, PawPrint } from 'lucide-react';
import L from 'leaflet';

// Types
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
  createdAt: string;
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
const categoryIcon = (categoryName: string, resolvido: boolean = false) => {
  const themeName = getThemeForCategory(categoryName);
  let color = THEMES[themeName]?.color || '#6b7280';
  if (resolvido) {
    color = '#94a3b8'; // gray-400 for resolved
  }
  
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="fill: ${color}; fill-opacity: 0.2;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

  return L.divIcon({
    className: 'custom-icon',
    html: svgIcon,
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

  // Form State
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Focos de Dengue');
  const [cpf, setCpf] = useState('');

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
        cpf
      };

      const response = await axios.post('/api/occurrences', newOccurrence);
      
      // Reset form and close modal
      setTitulo('');
      setDescricao('');
      setCpf('');
      setCategoria('Focos de Dengue');
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

  const handleSearchProtocol = () => {
    if (!searchProtocol.trim()) return;
    const found = occurrences.find(o => o.protocolo === searchProtocol.trim());
    if (found) {
      setSearchResult(found);
      setSearchError('');
    } else {
      setSearchResult(null);
      setSearchError('Protocolo não encontrado.');
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
    txtContent += '==================================================\n\n';
    
    unresolvedOccurrences.forEach(occ => {
      txtContent += `Protocolo: ${occ.protocolo}\n`;
      txtContent += `Título: ${occ.titulo}\n`;
      txtContent += `Categoria: ${occ.categoria}\n`;
      txtContent += `Descrição: ${occ.descricao}\n`;
      txtContent += `Data: ${new Date(occ.createdAt).toLocaleDateString('pt-BR')}\n`;
      txtContent += `CPF do Relator: ${occ.cpf || 'Não informado'}\n`;
      txtContent += `Status: ${occ.resolvido ? 'Resolvido' : 'Em aberto'}\n`;
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
          
          <button 
            onClick={() => setIsConsultModalOpen(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-slate-200"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Consultar Protocolo</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
        
        {/* Map Section */}
        <div className="w-full md:w-2/3 h-[50vh] md:h-[calc(100vh-140px)] rounded-xl border-2 border-slate-300 shadow-inner overflow-hidden relative shrink-0">
          <MapContainer 
            center={defaultCenter} 
            zoom={12} 
            className="w-full h-full z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapClickHandler onClick={handleMapClick} />

            {occurrences.map((occ) => (
              <Marker 
                key={occ.id} 
                position={[occ.latitude, occ.longitude]}
                icon={categoryIcon(occ.categoria, occ.resolvido)}
              >
                <Popup className="rounded-lg shadow-sm">
                  <div className="p-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className={`font-semibold ${occ.resolvido ? 'text-slate-500 line-through' : 'text-gray-900'}`}>{occ.titulo}</div>
                      {occ.resolvido && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <span className="inline-block px-2 py-1 bg-gray-100 text-xs font-medium rounded text-gray-800 mb-2">
                      {occ.categoria}
                    </span>
                    <p className="text-sm text-gray-600 mb-2">{occ.descricao}</p>
                    <div className="text-xs text-gray-400">
                      {new Date(occ.createdAt).toLocaleDateString('pt-BR')} 
                      <span className="block mt-1 font-mono text-[10px]">Protocolo: {occ.protocolo}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          
          <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur px-4 py-3 rounded-lg border border-slate-200 shadow-sm hidden sm:block">
            <h3 className="text-[10px] font-bold text-slate-900 mb-2 uppercase tracking-wider">Legenda</h3>
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] bg-gray-900/80 backdrop-blur text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-none">
            <PlusCircle className="w-4 h-4" />
            Clique no mapa para registrar um problema
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
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{occ.descricao}</p>
                      <div className="flex items-center justify-between">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase text-center rounded-full ${themeInfo?.bg} ${themeInfo?.text} max-w-full truncate`}>
                          {occ.categoria}
                        </span>
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
                      <p className="text-xs text-slate-500">{searchResult.categoria}</p>
                    </div>
                    {searchResult.resolvido ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Resolvido
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Pendente</span>
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
