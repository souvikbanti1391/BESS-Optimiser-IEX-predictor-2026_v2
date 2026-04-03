import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Battery, 
  Settings2, 
  Play, 
  ArrowUpRight, 
  ArrowDownRight,
  Zap,
  Clock,
  RefreshCcw,
  Loader2,
  Download,
  LayoutDashboard,
  Table as TableIcon,
  LineChart as ChartIcon,
  BarChart3,
  FileText,
  Calculator
} from 'lucide-react';
import { 
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { cn } from '../lib/utils';

export default function BessOptimizer({ 
  predictedPrices, 
  results, 
  setResults, 
  config,
  setConfig,
  onAddToReport,
  onSendToFinancials
}: { 
  predictedPrices: any[], 
  results: { naive: any | null, milp: any | null }, 
  setResults: (data: any, strategy: string) => void,
  config: any,
  setConfig: (config: any) => void,
  onAddToReport: (type: string, data: any) => void,
  onSendToFinancials?: () => void
}) {
  const energyMwh = config.capacityMw * config.duration;
  const [optimizer, setOptimizer] = useState('NAIVE');
  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [localPrices, setLocalPrices] = useState<any[]>([]);

  const currentResults = results[optimizer.toLowerCase() as keyof typeof results];

  // Automatic import if predictedPrices changes
  React.useEffect(() => {
    if (predictedPrices.length > 0) {
      setLocalPrices(predictedPrices);
      
      // Only set initial horizon if it's currently 0 or not yet set
      const days = Math.max(1, Math.ceil((new Date(predictedPrices[predictedPrices.length - 1].datetime).getTime() - new Date(predictedPrices[0].datetime).getTime()) / (1000 * 60 * 60 * 24)));
      if (!config.simulationDays || config.simulationDays === 0) {
        setConfig({ ...config, simulationDays: days, rollingDays: Math.min(7, days) });
      }
    }
  }, [predictedPrices]);

  const forecastDays = localPrices.length > 0 
    ? Math.max(1, Math.ceil((new Date(localPrices[localPrices.length - 1].datetime).getTime() - new Date(localPrices[0].datetime).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const importForecast = () => {
    if (predictedPrices.length === 0) {
      toast.error("No forecast data found in Predictor tab. Please run prediction first.");
      return;
    }
    setLocalPrices(predictedPrices);
    
    // Dynamically update horizon to match forecast length
    const days = Math.max(1, Math.ceil((new Date(predictedPrices[predictedPrices.length - 1].datetime).getTime() - new Date(predictedPrices[0].datetime).getTime()) / (1000 * 60 * 60 * 24)));
    setConfig({ ...config, simulationDays: days, rollingDays: Math.min(7, days) });
    
    toast.success(`Imported ${predictedPrices.length} data points from Predictor.`);
  };

  const runSimulation = async () => {
    if (!localPrices.length) {
      toast.error("Please import forecast data first!");
      return;
    }
    
    // Enforce horizon constraint
    if (config.simulationDays > forecastDays) {
      toast.error(`Simulation Horizon (${config.simulationDays} days) cannot exceed forecast length (${forecastDays} days).`);
      return;
    }

    setIsSimulating(true);
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: localPrices, config, strategy: optimizer })
      });
      const data = await response.json();
      
      if (data.error) {
        // Auto-fix if pulp or other libraries are missing
        if (data.error === "Python dependencies missing" || data.details?.includes("ModuleNotFoundError")) {
          toast.loading("Python dependencies missing. Attempting to install...");
          const fixRes = await fetch('/api/fix-python', { method: 'POST' });
          const fixData = await fixRes.json();
          if (fixData.success) {
            toast.success("Python environment fixed! Retrying optimization...");
            return runSimulation(); // Retry once
          }
        }
        throw new Error(data.error);
      }
      
      setResults({ ...data, config }, optimizer);
      const days = Math.round(data.results.length / (24 / (data.results.length > 1 ? Math.abs(new Date(data.results[1].datetime).getTime() - new Date(data.results[0].datetime).getTime()) / (1000 * 60 * 60) : 1)));
      toast.success(`Optimization complete for ${days} day(s) simulation!`);
    } catch (error: any) {
      toast.error(error.message || "Optimization failed.");
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleAddToReport = async () => {
    if (!currentResults) return;
    
    const toastId = toast.loading("Capturing results for report...");
    
    // Ultimate Style Shield: Bake computed styles to standard colors to prevent html2canvas parser errors
    const restoredStyles = new Map<HTMLElement, string>();
    const colorConverter = document.createElement('canvas').getContext('2d');
    
    const bakeStyles = (root: HTMLElement) => {
      const elements = root.getElementsByTagName('*');
      for (let j = 0; j < elements.length; j++) {
        const el = elements[j] as HTMLElement;
        try {
          const style = window.getComputedStyle(el);
          // Comprehensive list of properties to bake (layout + colors)
          const props = [
            'color', 'backgroundColor', 'borderColor', 'fill', 'stroke', 
            'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
            'outlineColor', 'stopColor', 'floodColor', 'lightingColor',
            'columnRuleColor', 'textDecorationColor', 'caretColor',
            'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'textAlign',
            'padding', 'margin', 'display', 'flexDirection', 'justifyContent', 'alignItems',
            'gap', 'width', 'height', 'position', 'top', 'left', 'right', 'bottom', 'zIndex',
            'opacity', 'visibility', 'overflow', 'borderRadius', 'boxShadow', 'borderStyle', 'borderWidth',
            'flex', 'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow', 'alignSelf', 'justifySelf',
            'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis', 'boxSizing'
          ];
          let modified = false;
          const originalInline = el.getAttribute('style') || '';
          
          props.forEach(prop => {
            const val = style.getPropertyValue(prop);
            if (val) {
              let safeVal = val;
              // Convert oklch/oklab to safe hex
              if (val.includes('oklch') || val.includes('oklab')) {
                if (colorConverter) {
                  colorConverter.fillStyle = val;
                  safeVal = colorConverter.fillStyle;
                } else {
                  safeVal = '#334155';
                }
              }
              // Always bake the value to preserve layout when stylesheets are removed
              el.style.setProperty(prop, safeVal, 'important');
              modified = true;
            }
          });
          
          // Also check for gradients in background-image
          const bgImg = style.getPropertyValue('background-image');
          if (bgImg && (bgImg.includes('oklch') || bgImg.includes('oklab'))) {
            el.style.setProperty('background-image', 'none', 'important');
            el.style.setProperty('background-color', '#334155', 'important');
            modified = true;
          }
          
          if (modified) {
            restoredStyles.set(el, originalInline);
          }
        } catch (e) {}
      }
    };

    const removedTags: { tag: Node, nextSibling: Node | null }[] = [];
    
    try {
      const element = document.getElementById('optimizer-full-content');
      if (element) {
        bakeStyles(element);
        
        // Nuclear Option: Temporarily REMOVE all style and link tags from the head
        // to prevent html2canvas from even attempting to parse them.
        const head = document.head;
        const styleRelatedTags = Array.from(head.querySelectorAll('style, link[rel="stylesheet"]'));
        
        styleRelatedTags.forEach(tag => {
          // Keep font stylesheets as they are usually safe and needed for text rendering
          if (tag instanceof HTMLLinkElement && tag.href.includes('fonts.googleapis.com')) {
            return;
          }
          removedTags.push({ tag, nextSibling: tag.nextSibling });
          try {
            head.removeChild(tag);
          } catch (e) {}
        });

        // Wait for UI to settle
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        const canvasPromise = html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc) => {
            // 1. Sanitize all inline styles in the clone
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(el => {
              const styleAttr = el.getAttribute('style');
              if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
                el.setAttribute('style', styleAttr.replace(/okl(ch|ab)\s*\([\s\S]*?\)/gi, '#334155'));
              }
            });

            // 2. Remove all link and style tags in the clone to prevent parser errors
            const styleRelated = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
            styleRelated.forEach(tag => {
              try {
                tag.parentNode?.removeChild(tag);
              } catch (e) {}
            });

            // 3. Inject a master "Light Theme" stylesheet with layout preservation
            const style = clonedDoc.createElement('style');
            style.textContent = `
              * {
                color-scheme: light !important;
                -webkit-print-color-adjust: exact !important;
              }
              body, #optimizer-full-content { 
                background-color: #ffffff !important; 
                color: #0f172a !important; 
                width: 100% !important;
                max-width: 1200px !important;
                margin: 0 auto !important;
              }
              .recharts-responsive-container {
                min-height: 350px !important;
                height: 350px !important;
              }
              /* Fallback for common backgrounds */
              [class*="bg-"] { background-color: #ffffff !important; }
              [class*="text-"] { color: #0f172a !important; }
              .text-slate-400, .text-slate-500 { color: #64748b !important; }
            `;
            clonedDoc.head.appendChild(style);
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Capture timed out (15s)")), 15000)
        );

        const canvas = await Promise.race([canvasPromise, timeoutPromise]) as HTMLCanvasElement;
        const imageData = canvas.toDataURL('image/png');
        onAddToReport(optimizer.toLowerCase(), { ...currentResults, imageData });
        toast.success("Added to report", { id: toastId });
      } else {
        onAddToReport(optimizer.toLowerCase(), currentResults);
        toast.error("Could not capture visualization, adding data only", { id: toastId });
      }
    } catch (error) {
      console.error("Capture error:", error);
      onAddToReport(optimizer.toLowerCase(), currentResults);
      toast.error(`Capture error: ${error instanceof Error ? error.message : String(error)}`, { id: toastId });
    } finally {
      // Restore original tags
      const head = document.head;
      removedTags.reverse().forEach(({ tag, nextSibling }) => {
        head.insertBefore(tag, nextSibling);
      });
      
      // Restore baked styles
      restoredStyles.forEach((original, el) => {
        if (original) {
          el.setAttribute('style', original);
        } else {
          el.removeAttribute('style');
        }
      });
    }
  };

  const exportData = (format: 'csv' | 'xlsx') => {
    if (!currentResults) return;

    const configMetadata = [
      { Parameter: "--- BESS CONFIGURATION ---", Value: "" },
      { Parameter: "Battery Power Rating (MW)", Value: config.capacityMw },
      { Parameter: "Battery Duration (Hours)", Value: config.duration },
      { Parameter: "Energy Capacity (MWh)", Value: energyMwh },
      { Parameter: "Min SOC (%)", Value: config.socMin },
      { Parameter: "Max SOC (%)", Value: config.socMax },
      { Parameter: "Initial SOC (%)", Value: config.socInit },
      { Parameter: "Charge Efficiency (%)", Value: config.etaC },
      { Parameter: "Discharge Efficiency (%)", Value: config.etaD },
      { Parameter: "Degradation Cost (Rs/kWh)", Value: config.degradation },
      { Parameter: "Max Cycles/Day", Value: config.cycles },
      { Parameter: "Lower Percentile", Value: config.lowPercentile },
      { Parameter: "Upper Percentile", Value: config.highPercentile },
      { Parameter: "Forecast Horizon (Days)", Value: config.rollingDays },
      { Parameter: "", Value: "" },
      { Parameter: "Optimizer Strategy", Value: optimizer.toUpperCase() },
      { Parameter: "--- PERFORMANCE SUMMARY ---", Value: "" },
      { Parameter: "Operational Revenue (Daily) (Rs)", Value: currentResults.summary.dailyRevenue },
      { Parameter: "Operational Revenue (Weekly Proj.) (Rs)", Value: currentResults.summary.weeklyRevenue },
      { Parameter: "Operational Revenue (Annualised Proj.) (Rs)", Value: currentResults.summary.annualRevenue },
      { Parameter: "Total Equivalent Full Cycles", Value: currentResults.summary.totalCycles },
      { Parameter: "Average Cycles per Day", Value: currentResults.summary.avgCyclesPerDay },
      { Parameter: "Total Charge Duration (Hours)", Value: currentResults.summary.chargeDuration },
      { Parameter: "Total Discharge Duration (Hours)", Value: currentResults.summary.dischargeDuration },
      { Parameter: "Total Idle Duration (Hours)", Value: currentResults.summary.idleDuration },
      { Parameter: "Best Discharge Window", Value: currentResults.summary.bestDischargeWindow },
      { Parameter: "Best Discharge Price (Rs/kWh)", Value: currentResults.summary.bestDischargePrice },
      { Parameter: "Best Charge Window", Value: currentResults.summary.bestChargeWindow },
      { Parameter: "Best Charge Price (Rs/kWh)", Value: currentResults.summary.bestChargePrice },
      { Parameter: "", Value: "" },
      { Parameter: "--- DISPATCH SCHEDULE ---", Value: "" }
    ];

    const scheduleData = currentResults.results.map((r: any) => ({
      DateTime: r.datetime,
      Price: r.mcp.toFixed(4),
      Action: r.action.toUpperCase(),
      SOC: r.soc.toFixed(2)
    }));

    if (format === 'csv') {
      const configCsv = Papa.unparse(configMetadata);
      const scheduleCsv = Papa.unparse(scheduleData);
      const combinedCsv = configCsv + "\n\n" + scheduleCsv;
      
      const blob = new Blob([combinedCsv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bess_optimization_report.csv`;
      a.click();
    } else {
      const wb = XLSX.utils.book_new();
      
      // Create a combined array for the Excel sheet
      const combinedData = [
        ...configMetadata.map(m => ({ "Column1": m.Parameter, "Column2": m.Value })),
        {}, // Empty row
        ...scheduleData
      ];

      const ws = XLSX.utils.json_to_sheet(combinedData, { skipHeader: true });
      XLSX.utils.book_append_sheet(wb, ws, "Optimization Report");
      XLSX.writeFile(wb, "bess_optimization_report.xlsx");
    }
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-8" id="optimizer-full-content">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">BESS Scheduling Optimiser</h2>
          <p className="text-slate-400">Configure battery parameters and optimize charge/discharge cycles.</p>
          {currentResults && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              Simulation Horizon: {Math.round(currentResults.results.length / (24 / (currentResults.results.length > 1 ? Math.abs(new Date(currentResults.results[1].datetime).getTime() - new Date(currentResults.results[0].datetime).getTime()) / (1000 * 60 * 60) : 1)))} Day(s)
            </div>
          )}
        </div>
        {results && (
          <div className="flex flex-wrap gap-2">
            {(results.naive || results.milp) && (
              <button 
                onClick={onSendToFinancials}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-500 flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
              >
                <Calculator className="w-4 h-4" /> Send to Financials
              </button>
            )}
            <button 
              onClick={handleAddToReport}
              className="bg-slate-800 border border-slate-700 text-blue-400 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4" /> Include in Report
            </button>
            <button 
              onClick={() => exportData('csv')}
              className="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button 
              onClick={() => exportData('xlsx')}
              className="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" /> XLSX
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Configuration Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-400" />
              Battery Config
            </h3>

            <div className="space-y-6">
              {/* Primary Sliders */}
              {[
                { label: "Capacity (MW)", key: "capacityMw", min: 10, max: 300, step: 10, unit: "MW" },
                { label: "Duration (Hrs)", key: "duration", min: 1, max: 6, step: 1, unit: "Hrs" },
                { label: "Cycles / Day", key: "cycles", min: 1, max: 2, step: 1, unit: "Cycles" }
              ].map((item) => (
                <div key={item.key}>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.label}</label>
                    <span className="text-xs font-bold text-blue-400">{(config as any)[item.key]} {item.unit}</span>
                  </div>
                  <input 
                    type="range" 
                    min={item.min} 
                    max={item.max} 
                    step={item.step}
                    value={isNaN((config as any)[item.key]) ? '' : (config as any)[item.key]}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setConfig({ ...config, [item.key]: isNaN(val) ? 0 : val });
                    }}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              ))}

              {/* Derived Energy Display */}
              <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Energy (MWh)</span>
                  <span className="text-lg font-extrabold text-white">{energyMwh} MWh</span>
                </div>
              </div>

              {/* Advanced Parameters Accordion-like structure */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Advanced Parameters</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Min SOC (%)</label>
                    <input 
                      type="number" 
                      value={isNaN(config.socMin) ? '' : config.socMin}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, socMin: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Max SOC (%)</label>
                    <input 
                      type="number" 
                      value={isNaN(config.socMax) ? '' : config.socMax}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, socMax: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Initial SOC (%)</label>
                    <input 
                      type="number" 
                      value={isNaN(config.socInit) ? '' : config.socInit}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, socInit: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Sim. Horizon (Days)</label>
                    <input 
                      type="number" 
                      min={1}
                      max={forecastDays || 30}
                      value={isNaN(config.simulationDays) ? '' : config.simulationDays}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val)) {
                          setConfig({ ...config, simulationDays: 0 });
                          return;
                        }
                        if (val > forecastDays && forecastDays > 0) {
                          toast.error(`Horizon cannot exceed forecast length (${forecastDays} days)`);
                          setConfig({ ...config, simulationDays: forecastDays });
                        } else {
                          setConfig({ ...config, simulationDays: val });
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Lookahead (Days)</label>
                    <input 
                      type="number" 
                      min={1}
                      max={forecastDays || 30}
                      value={isNaN(config.rollingDays) ? '' : config.rollingDays}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, rollingDays: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Charge Eff. (%)</label>
                    <input 
                      type="number" 
                      value={isNaN(config.etaC) ? '' : config.etaC}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, etaC: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Discharge Eff. (%)</label>
                    <input 
                      type="number" 
                      value={isNaN(config.etaD) ? '' : config.etaD}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, etaD: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Degradation Cost (₹/kWh)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={isNaN(config.degradation) ? '' : config.degradation}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, degradation: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">Low P-tile</label>
                    <input 
                      type="number" 
                      value={isNaN(config.lowPercentile) ? '' : config.lowPercentile}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, lowPercentile: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase min-h-[1.25rem] flex items-end">High P-tile</label>
                    <input 
                      type="number" 
                      value={isNaN(config.highPercentile) ? '' : config.highPercentile}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({ ...config, highPercentile: isNaN(val) ? 0 : val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Optimizer Strategy</label>
                <select 
                  value={optimizer}
                  onChange={(e) => setOptimizer(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="NAIVE">Naive (Threshold Based)</option>
                  <option value="MILP">MILP (Global Optimum)</option>
                </select>
              </div>

              <div className="space-y-2">
                <button
                  onClick={importForecast}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"
                >
                  <Download className="w-4 h-4 rotate-180" />
                  Import Forecast Data
                </button>

                <button
                  disabled={isSimulating}
                  onClick={runSimulation}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {isSimulating ? <Loader2 className="animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                  Simulate Schedule
                </button>
                <button
                  onClick={async () => {
                    const id = toast.loading("Fixing Python environment...");
                    try {
                      const res = await fetch('/api/fix-python', { method: 'POST' });
                      const data = await res.json();
                      if (data.success) toast.success("Environment fixed!", { id });
                      else throw new Error(data.error);
                    } catch (e: any) {
                      toast.error(e.message || "Failed to fix environment", { id });
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-400 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-all opacity-50 hover:opacity-100"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Fix Python Environment
                </button>
              </div>
            </div>
          </div>
        </div>        {/* Results Main Area */}
        <div className="lg:col-span-3 space-y-6">
          {currentResults ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm group hover:border-orange-500/50 transition-all">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1 min-h-[2.5rem]">Operational Revenue (Daily)</p>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-white leading-none">₹{Number(currentResults.summary.dailyRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    <div className="bg-orange-900/20 p-2 rounded-lg group-hover:bg-orange-900/40 transition-colors flex items-center justify-center">
                      <ArrowUpRight className="text-orange-400 w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm group hover:border-blue-500/50 transition-all">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1 min-h-[2.5rem]">Operational Revenue (Weekly Proj.)</p>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-white leading-none">₹{Number(currentResults.summary.weeklyRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    <div className="bg-blue-900/20 p-2 rounded-lg group-hover:bg-blue-900/40 transition-colors flex items-center justify-center">
                      <ArrowUpRight className="text-blue-400 w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm group hover:border-green-500/50 transition-all">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1 min-h-[2.5rem]">Operational Revenue (Annualised Proj.)</p>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-white leading-none">₹{Number(currentResults.summary.annualRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    <div className="bg-green-900/20 p-2 rounded-lg group-hover:bg-green-900/40 transition-colors flex items-center justify-center">
                      <ArrowUpRight className="text-green-400 w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm group hover:border-indigo-500/50 transition-all">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1 min-h-[2.5rem]">Total Profit (Simulation Period)</p>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-white leading-none">₹{Number(currentResults.summary.totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                    <div className="bg-indigo-900/20 p-2 rounded-lg group-hover:bg-indigo-900/40 transition-colors flex items-center justify-center">
                      <Zap className="text-indigo-400 w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed KPI Block */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Operational Metrics Card */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md border-t-4 border-t-blue-500">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4" />
                    Operational Metrics
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                      <span className="text-sm text-slate-400">Market Cycles Executed</span>
                      <span className="text-sm font-bold text-white">{Number(currentResults.summary.totalCycles).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                      <span className="text-sm text-slate-400">Avg Cycles / Day</span>
                      <span className="text-sm font-bold text-white">{Number(currentResults.summary.avgCyclesPerDay).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                      <span className="text-sm text-slate-400">Charge Duration</span>
                      <span className="text-sm font-bold text-white">{Number(currentResults.summary.chargeDuration).toFixed(2)} Hrs</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                      <span className="text-sm text-slate-400">Discharge Duration</span>
                      <span className="text-sm font-bold text-white">{Number(currentResults.summary.dischargeDuration).toFixed(2)} Hrs</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Idle Duration</span>
                      <span className="text-sm font-bold text-white">{Number(currentResults.summary.idleDuration).toFixed(2)} Hrs</span>
                    </div>
                  </div>
                </div>

                {/* Best Charge Window Card */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md border-t-4 border-t-emerald-500">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4" />
                    Best Charge Window
                  </h4>
                  <div className="space-y-6">
                    <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-500/70 uppercase font-bold mb-1">Optimal Window</p>
                      <p className="text-sm font-medium text-slate-200 leading-relaxed">
                        {currentResults.summary.bestChargeWindow}
                      </p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                      <span className="text-sm text-slate-400">Best Price</span>
                      <span className="text-lg font-bold text-emerald-400">₹{Number(currentResults.summary.bestChargePrice).toFixed(2)}/kWh</span>
                    </div>
                  </div>
                </div>

                {/* Best Discharge Window Card */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md border-t-4 border-t-amber-500">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Best Discharge Window
                  </h4>
                  <div className="space-y-6">
                    <div className="bg-amber-900/10 p-4 rounded-xl border border-amber-500/20">
                      <p className="text-[10px] text-amber-500/70 uppercase font-bold mb-1">Optimal Window</p>
                      <p className="text-sm font-medium text-slate-200 leading-relaxed">
                        {currentResults.summary.bestDischargeWindow}
                      </p>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                      <span className="text-sm text-slate-400">Best Price</span>
                      <span className="text-lg font-bold text-amber-400">₹{Number(currentResults.summary.bestDischargePrice).toFixed(2)}/kWh</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Forecast Diagnostics Card */}
              {currentResults.diagnostics && (
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md border-t-4 border-t-indigo-500">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Forecast Diagnostics
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Mean Price", value: `₹${currentResults.diagnostics.meanPrice}`, sub: "Average" },
                      { label: "Price Range", value: `₹${currentResults.diagnostics.priceRange}`, sub: "Max - Min" },
                      { label: "P90-P10 Spread", value: `₹${currentResults.diagnostics.p90p10Spread}`, sub: "Volatility" },
                      { label: "Avg Daily Spread", value: `₹${currentResults.diagnostics.avgDailySpread}`, sub: "Daily Vol" },
                      { label: "Min Price", value: `₹${currentResults.diagnostics.minPrice}`, sub: "Floor" },
                      { label: "Max Price", value: `₹${currentResults.diagnostics.maxPrice}`, sub: "Ceiling" },
                      { label: "Max Daily Spread", value: `₹${currentResults.diagnostics.maxDailySpread}`, sub: "Peak Vol" },
                      { label: "Optimiser Mode", value: optimizer, sub: "Strategy" }
                    ].map((diag, idx) => (
                      <div key={idx} className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30 text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{diag.label}</p>
                        <p className="text-sm font-bold text-white">{diag.value}</p>
                        <p className="text-[9px] text-slate-600 mt-1 italic">{diag.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* View Toggle */}
              <div className="flex justify-end">
                <div className="bg-slate-900 p-1 rounded-xl flex gap-1 border border-slate-800">
                  <button 
                    onClick={() => setViewMode('chart')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'chart' ? "bg-slate-800 shadow-sm text-blue-400" : "text-slate-500 hover:text-slate-300")}
                  >
                    <ChartIcon className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'table' ? "bg-slate-800 shadow-sm text-blue-400" : "text-slate-500 hover:text-slate-300")}
                  >
                    <TableIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Schedule Display */}
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm min-h-[450px]">
                <h3 className="font-bold text-white mb-6">Optimized Schedule & Price Signals</h3>
                
                {viewMode === 'chart' ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart 
                      data={currentResults.results.map((r: any) => ({
                        ...r,
                        price: isNaN(r.price) ? null : r.price,
                        soc: isNaN(r.soc) ? null : r.soc,
                        charge: (r.charge > 0 && !isNaN(r.charge)) ? r.charge : null,
                        discharge: (r.discharge > 0 && !isNaN(r.discharge)) ? r.discharge : null
                      }))} 
                      barCategoryGap={0}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="datetime" 
                        tick={{ fontSize: 12, fill: '#cbd5e1' }} 
                        hide={false} 
                        axisLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
                        tickLine={{ stroke: '#94a3b8' }}
                      />
                      <YAxis 
                        yAxisId="left" 
                        tick={{ fontSize: 12, fill: '#f8fafc' }} 
                        tickFormatter={(val) => `₹${Number(val).toFixed(0)}`} 
                        label={{ value: 'Price (₹/kWh)', angle: -90, position: 'insideLeft', fontSize: 14, fill: '#f8fafc', fontWeight: 'bold', offset: 10 }} 
                        axisLine={{ stroke: '#475569' }}
                        tickLine={{ stroke: '#475569' }}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tick={{ fontSize: 12, fill: '#facc15' }} 
                        tickFormatter={(val) => `${val}%`} 
                        label={{ value: 'SOC %', angle: 90, position: 'insideRight', fontSize: 14, fill: '#facc15', fontWeight: 'bold', offset: 10 }} 
                        axisLine={{ stroke: '#475569' }}
                        tickLine={{ stroke: '#475569' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          border: '2px solid #334155', 
                          borderRadius: '12px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                          padding: '16px'
                        }}
                        itemStyle={{ 
                          fontSize: '13px', 
                          color: '#f1f5f9',
                          fontWeight: '600',
                          padding: '4px 0'
                        }}
                        labelStyle={{
                          fontSize: '12px',
                          color: '#94a3b8',
                          marginBottom: '10px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em'
                        }}
                        formatter={(value: any, name: string, props: any) => {
                          if (name === 'MCP') return [`₹${Number(value).toFixed(2)}`, 'Market Price'];
                          if (name === 'SOC') return [`${Number(value).toFixed(1)}%`, 'Battery SOC'];
                          if (name === 'Operating Mode') return [props.payload.action.toUpperCase(), name];
                          return [value, name];
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={60} 
                        iconType="rect" 
                        wrapperStyle={{ fontSize: '13px', color: '#f1f5f9', paddingTop: '40px', fontWeight: '600' }}
                        payload={[
                          { value: 'Market Price (₹/kWh)', type: 'line', id: 'mcp', color: '#38bdf8' },
                          { value: 'Battery SOC (%)', type: 'line', id: 'soc', color: '#facc15' },
                          { value: 'Charge Mode', type: 'rect', id: 'charge', color: '#f59e0b' },
                          { value: 'Discharge Mode', type: 'rect', id: 'discharge', color: '#10b981' },
                          { value: 'Idle Mode', type: 'rect', id: 'idle', color: '#475569' },
                        ]}
                      />
                      
                      {/* Background Action Bars */}
                      <Bar yAxisId="left" dataKey="mcp" name="Operating Mode" isAnimationActive={false}>
                        {currentResults.results.map((entry: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.action === 'charge' ? '#f59e0b' : // Orange
                              entry.action === 'discharge' ? '#10b981' : // Green
                              '#475569' // Slate
                            } 
                            fillOpacity={0.6}
                          />
                        ))}
                      </Bar>

                      {/* Price Line */}
                      <Area 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="mcp" 
                        fill="transparent" 
                        stroke="#38bdf8" // Sky Blue
                        strokeWidth={4} 
                        name="MCP" 
                        dot={false} 
                      />

                      {/* SOC Line */}
                      <Line 
                        yAxisId="right" 
                        type="stepAfter" 
                        dataKey="soc" 
                        stroke="#facc15" // Yellow
                        strokeWidth={4} 
                        dot={false} 
                        name="SOC" 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="overflow-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-400 uppercase bg-slate-900 sticky top-0">
                        <tr>
                          <th className="px-4 py-3">DateTime</th>
                          <th className="px-4 py-3">Price (Rs/kWh)</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">SOC (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {currentResults.results.map((r: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-200">{r.datetime}</td>
                            <td className="px-4 py-3 text-slate-300">₹{Number(r.mcp).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                                r.action === 'charge' ? "bg-orange-900/30 text-orange-400" : 
                                r.action === 'discharge' ? "bg-green-900/30 text-green-400" : 
                                "bg-slate-800 text-slate-400"
                              )}>
                                {r.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{r.soc.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Profit & Price Overlay Chart */}
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm min-h-[450px] mt-8">
                <h3 className="font-bold text-white mb-6">Block-wise Arbitrage revenue & Price Overlay</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={currentResults.results}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="datetime" 
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      axisLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
                      tickLine={{ stroke: '#94a3b8' }}
                    />
                    <YAxis 
                      yAxisId="left" 
                      width={100}
                      tick={{ fontSize: 12, fill: '#a855f7' }} 
                      tickFormatter={(val) => `${(val / 100000).toFixed(2)}`} 
                      label={{ value: 'Arbitrage revenue (Rs. Lakhs)', angle: -90, position: 'insideLeft', fontSize: 14, fill: '#a855f7', fontWeight: 'bold', offset: 10 }} 
                      axisLine={{ stroke: '#475569' }}
                      tickLine={{ stroke: '#475569' }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      tick={{ fontSize: 12, fill: '#38bdf8' }} 
                      tickFormatter={(val) => `₹${Number(val).toFixed(2)}`} 
                      label={{ value: 'Price (₹/kWh)', angle: 90, position: 'insideRight', fontSize: 14, fill: '#38bdf8', fontWeight: 'bold', offset: 10 }} 
                      axisLine={{ stroke: '#475569' }}
                      tickLine={{ stroke: '#475569' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: '2px solid #334155', 
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                        padding: '16px'
                      }}
                      itemStyle={{ fontSize: '13px', color: '#f1f5f9', fontWeight: '600' }}
                      labelStyle={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px', fontWeight: '700' }}
                      formatter={(value: any, name: string) => {
                        if (name === 'Market Price (₹/kWh)') return [`₹${Number(value).toFixed(2)}`, name];
                        return [`₹${(Number(value) / 100000).toFixed(2)} Lakhs`, "Arbitrage Revenue"];
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={60}
                      wrapperStyle={{ paddingTop: '40px', fontSize: '13px', color: '#f1f5f9', fontWeight: '600' }}
                    />
                    <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" strokeWidth={2} />
                    <Bar 
                      yAxisId="left" 
                      dataKey="profit" 
                      name="Arbitrage Revenue" 
                      radius={[4, 4, 0, 0]}
                      opacity={0.7}
                    >
                      {currentResults.results.map((entry: any, index: number) => (
                        <Cell 
                          key={`cell-profit-${index}`} 
                          fill={entry.profit >= 0 ? '#10b981' : '#f59e0b'} 
                        />
                      ))}
                    </Bar>
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="mcp" 
                      name="Market Price (₹/kWh)" 
                      stroke="#38bdf8" 
                      strokeWidth={3} 
                      dot={false} 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-800 h-[600px] flex flex-col items-center justify-center text-center p-8 backdrop-blur-sm">
              <div className="bg-slate-800 p-6 rounded-full mb-6">
                <Battery className="w-12 h-12 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Simulation Data</h3>
              <p className="text-slate-400 max-w-md">
                {localPrices.length > 0 
                  ? "Forecast data imported! Click 'Simulate Schedule' to generate the optimal BESS plan."
                  : "First, run a prediction in the IEX Predictor tab, then click 'Import Forecast Data' here to begin optimization."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
