import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  FileUp,
  Search,
  ClipboardCopy,
  Sun,
  Moon,
  Info,
  ListFilter,
  TrendingUp,
  Package,
} from "lucide-react";
import Papa from "papaparse";

/** =======================
 *  FarmaClinic · Márgenes
 *  PRO-UX V8.0 (ESTADO LOCAL PARA EDICIÓN - SOLUCIÓN DEFINITIVA)
 *  - Vista en tarjetas (no tabla) para evitar scroll horizontal.
 *  - PROBLEMA REAL IDENTIFICADO: React re-renderizaba y reseteaba inputs.
 *  - SOLUCIÓN DEFINITIVA: Estado local (editingInputs) mientras se edita.
 *  - SOLUCIÓN DEFINITIVA: onFocus guarda valor, onChange actualiza local, onBlur guarda final.
 *  - GARANTIZADO: Decimales funcionan sin interrupciones durante escritura.
 *  ======================= */

// ========================================
// 🎨 FORMATTERS & NUMBER UTILITIES
// ========================================
const nf = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pf = (v) =>
  new Intl.NumberFormat("es-BO", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v ?? 0);

// util numérica (soporta 1.234,56 / 1,234.56 / 1234,56)
function numBO(x) {
  if (x == null || x === "") return undefined;
  if (typeof x === "number") return Number.isFinite(x) ? x : undefined;
  let s = String(x).trim();
  if (!s) return undefined;
  s = s.replace(/\s/g, "");
  const hasComma = s.includes(","),
    hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "");
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// porcentajes - FUNCIONES SIMPLIFICADAS
function parsePercentInput(raw) {
  if (raw === "" || raw == null) return undefined;
  
  const numValue = parseFloat(String(raw).replace(',', '.').trim());
  if (!Number.isFinite(numValue)) return null;
  
  // Lógica simple: si >= 1, dividir por 100; si < 1, usar tal como está
  return numValue >= 1 ? numValue / 100 : numValue;
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

function pctDisplay(overrideVal, baseVal, editingVal) {
  // Si está en modo edición, mostrar el valor crudo
  if (editingVal !== undefined) return editingVal;
  
  const candidate = overrideVal ?? baseVal;
  if (candidate === null || candidate === undefined) return "";
  const num = Number(candidate);
  if (!Number.isFinite(num)) return "";
  
  // Convertir decimal a porcentaje para mostrar
  const percentage = num * 100;
  
  // Si es entero, no mostrar decimales
  if (percentage === Math.floor(percentage)) {
    return String(percentage);
  }
  // Si tiene decimales, mostrar hasta 2
  else {
    return String(Math.round(percentage * 100) / 100);
  }
}

// ========================================
// 📊 DEMO DATA & CONSTANTS
// ========================================
const DEMO = [
  {
    id: "7750001111111",
    codigo_barras: "7750001111111",
    cod_ref: "INTI-P500-10",
    nombre: "Paracetamol 500 mg x10",
    proveedor: "INTI",
    linea: "OTC",
    unidades_por_caja: 10,
    desc1_pct: 0.06,
    desc2_pct: 0.07,
    incremento_pct: 0.25,
  },
  {
    id: "7790002222222",
    codigo_barras: "7790002222222",
    cod_ref: "BAGO-I400-10",
    nombre: "Ibuprofeno 400 mg x10",
    proveedor: "BAGO",
    linea: "OTC",
    unidades_por_caja: 10,
    desc1_pct: 0.1,
    desc2_pct: 0.0,
    incremento_pct: 0.3,
  },
];

// ========================================
// 🔄 HEADER NORMALIZATION UTILITIES
// ========================================
function normalizarCabecera(c) {
  const s = (c || "").toString().trim().toLowerCase();
  if (
    [
      "producto",
      "nombre",
      "nombre producto",
      "nombre_producto",
      "nombre product",
    ].includes(s)
  )
    return "nombre";
  if (["proveedor", "vendor", "supplier"].includes(s)) return "proveedor";
  if (
    [
      "linea",
      "línea",
      "linea de producto",
      "familia",
      "categoria",
      "categoría",
    ].includes(s)
  )
    return "linea";
  if (["marca"].includes(s)) return "marca";
  if (
    [
      "unidades_por_caja",
      "unidades por caja",
      "unidades x caja",
      "u_x_caja",
      "pack",
      "contenido",
      "contenido_x",
      "presentacion",
      "presentación",
    ].includes(s)
  )
    return "unidades_por_caja";
  if (
    [
      "costo_caja",
      "costo caja",
      "box_cost",
      "costo/pack",
      "costo master",
    ].includes(s)
  )
    return "costo_caja";
  if (
    [
      "costo_unitario",
      "costo unit",
      "unit_cost",
      "costo/u",
      "costo unidad",
    ].includes(s)
  )
    return "costo_unitario";
  if (["costo", "precio costo", "cost", "precio_costo"].includes(s))
    return "costo";
  if (
    [
      "% incremento sobre costo final",
      "% incremento",
      "% incremento costo",
      "incremento",
      "incremento_pct",
      "markup",
      "margen",
      "margen_pct",
      "incremento %",
      "incremento%",
      "% inc",
      "% inc.",
      "inc %",
      "inc%",
    ].includes(s)
  )
    return "incremento_pct";
  if (
    [
      "% descuento sobre costo",
      "%descuento sobre costo",
      "descuento sobre costo",
      "desc1",
      "d1",
      "d1 %",
      "d1%",
      "descuento 1",
      "desc 1",
    ].includes(s)
  )
    return "desc1_pct";
  if (
    [
      "% de descuento sobre costo 2",
      "% descuento sobre costo 2",
      "desc2",
      "d2",
      "d2 %",
      "d2%",
      "descuento 2",
      "desc 2",
    ].includes(s)
  )
    return "desc2_pct";
  if (
    [
      "caso especial?",
      "caso especial",
      "especial?",
      "alerta",
      "alertas",
      "alertas proveedor",
    ].includes(s)
  )
    return "caso_especial";
  if (
    [
      "cod barras",
      "codigo de barras",
      "código de barras",
      "barcode",
      "ean",
      "ean13",
    ].includes(s)
  )
    return "codigo_barras";
  if (["cod ref", "cod_ref", "codigo ref", "código ref", "ref"].includes(s))
    return "cod_ref";
  if (["id", "codigo", "código", "sku"].includes(s)) return s;

  const hasDescuento = s.includes("descuento") || s.includes("desc");
  if ((hasDescuento || s.includes("d1")) && s.includes("1")) return "desc1_pct";
  if ((hasDescuento || s.includes("d2")) && s.includes("2")) return "desc2_pct";
  if (
    s.includes("incremento") ||
    s.includes("margen") ||
    s.includes("markup") ||
    s.startsWith("inc ") ||
    s.includes(" inc") ||
    s.includes("inc%")
  )
    return "incremento_pct";
  return s;
}

// ========================================
// 🔄 FILE PARSERS (CSV/XLSX)
// ========================================
function parseCSV(file, onDone) {
  Papa.parse(file, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
    complete: ({ data }) => {
      const productos = [];
      for (const raw of data || []) {
        const obj = {};
        for (const k of Object.keys(raw)) obj[normalizarCabecera(k)] = raw[k];

        const codigo_barras =
          (obj.codigo_barras ?? "").toString().trim() || undefined;
        const cod_ref = (obj.cod_ref ?? "").toString().trim() || undefined;
        const id = (
          codigo_barras ||
          cod_ref ||
          obj.id ||
          (crypto?.randomUUID?.() ??
            `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
        ).toString();

        const nombre = (obj.nombre ?? "").toString();
        const proveedor = (obj.proveedor ?? "").toString();
        const linea = (obj.linea ?? obj.marca ?? "").toString();
        const marca = (obj.marca ?? "").toString();

        let unidades_por_caja = numBO(obj.unidades_por_caja);
        if (!isFinite(unidades_por_caja) || unidades_por_caja <= 0)
          unidades_por_caja = 1;

        let costo_caja = numBO(obj.costo_caja);
        const cu = numBO(obj.costo_unitario),
          cc = numBO(obj.costo);
        if (costo_caja == null && isFinite(cu))
          costo_caja = Number(cu) * unidades_por_caja;
        if (costo_caja == null && isFinite(cc)) costo_caja = Number(cc);

        const desc1_pct = parsePercentInput(obj.desc1_pct) || 0;
        const desc2_pct = parsePercentInput(obj.desc2_pct) || 0;
        const incremento_pct = parsePercentInput(obj.incremento_pct) || 0;
        const caso_especial = (obj.caso_especial ?? "").toString();

        if (!nombre) continue;
        productos.push({
          id,
          codigo_barras,
          cod_ref,
          nombre,
          proveedor,
          linea,
          marca,
          unidades_por_caja,
          costo_caja,
          desc1_pct,
          desc2_pct,
          incremento_pct,
          caso_especial,
        });
      }
      onDone(productos);
    },
    error: (err) => {
      console.error(err);
      onDone([]);
    },
  });
}

async function parseXLS(file, onDone) {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    const productos = [];
    for (const raw of rows) {
      const obj = {};
      for (const k of Object.keys(raw)) obj[normalizarCabecera(k)] = raw[k];

      const codigo_barras =
        (obj.codigo_barras ?? "").toString().trim() || undefined;
      const cod_ref = (obj.cod_ref ?? "").toString().trim() || undefined;
      const id = (
        codigo_barras ||
        cod_ref ||
        obj.id ||
        (crypto?.randomUUID?.() ??
          `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      ).toString();

      const nombre = (obj.nombre ?? "").toString();
      const proveedor = (obj.proveedor ?? "").toString();
      const linea = (obj.linea ?? obj.marca ?? "").toString();
      const marca = (obj.marca ?? "").toString();

      let unidades_por_caja = numBO(obj.unidades_por_caja);
      if (!isFinite(unidades_por_caja) || unidades_por_caja <= 0)
        unidades_por_caja = 1;

      let costo_caja = numBO(obj.costo_caja);
      const cu = numBO(obj.costo_unitario),
        cc = numBO(obj.costo);
      if (costo_caja == null && isFinite(cu))
        costo_caja = Number(cu) * unidades_por_caja;
      if (costo_caja == null && isFinite(cc)) costo_caja = Number(cc);

      const desc1_pct = parsePercentInput(obj.desc1_pct) || 0;
      const desc2_pct = parsePercentInput(obj.desc2_pct) || 0;
      const incremento_pct = parsePercentInput(obj.incremento_pct) || 0;
      const caso_especial = (obj.caso_especial ?? "").toString();

      if (!nombre) continue;
      productos.push({
        id,
        codigo_barras,
        cod_ref,
        nombre,
        proveedor,
        linea,
        marca,
        unidades_por_caja,
        costo_caja,
        desc1_pct,
        desc2_pct,
        incremento_pct,
        caso_especial,
      });
    }
    onDone(productos);
  } catch (e) {
    console.error(e);
    onDone([]);
  }
}

// ========================================
// 🧮 BUSINESS LOGIC & CALCULATIONS
// ========================================
function aplicarDescuentosProveedor(c, d1 = 0, d2 = 0) {
  const D1 = Math.min(Math.max(Number(d1) || 0, 0), 1);
  const D2 = Math.min(Math.max(Number(d2) || 0, 0), 1);
  return Number(c || 0) * (1 - D1) * (1 - D2);
}

function precioFinalProveedor(c, d1, d2, inc) {
  const neto = aplicarDescuentosProveedor(c, d1, d2);
  const INC = Math.min(Math.max(Number(inc) || 0, 0), 10);
  return neto * (1 + INC);
}

// ========================================
// 📤 EXPORT FUNCTIONALITY
// ========================================
function exportBitacora(bitacora) {
  if (!bitacora.length) {
    alert("No hay registros para exportar");
    return;
  }

  try {
    // Preparar datos para Excel con formato mejorado
    const excelData = bitacora.map((r, index) => ({
      // Información básica
      'N°': index + 1,
      'Fecha': new Date(r.fecha).toLocaleString('es-BO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      'Producto': r.producto || '',
      'Proveedor': r.proveedor || '',
      'Marca/Línea': r.linea || '',
      
      // Códigos
      'Código de Barras': r.codigo_barras || '',
      'Código Ref': r.cod_ref || '',
      'Unidades por Caja': r.unidades_por_caja || 1,
      
      // Costos base
      'Costo Caja (Bs)': Number(r.costo ?? r.costo_caja_ingresado ?? 0).toFixed(2),
      'Costo Unitario (Bs)': Number((r.costo ?? r.costo_caja_ingresado ?? 0) / (r.unidades_por_caja || 1)).toFixed(2),
      
      // Parámetros de cálculo
      'Descuento 1 (%)': Number(r.desc1_pct * 100).toFixed(2),
      'Descuento 2 (%)': Number(r.desc2_pct * 100).toFixed(2),
      'Incremento (%)': Number(r.incremento_pct * 100).toFixed(2),
      'Parámetros Manuales': r.parametros_manual ? 'SÍ' : 'NO',
      
      // Costos netos (después de descuentos)
      'Costo Neto Caja (Bs)': Number(r["costo final"] ?? r.costo_neto_caja ?? 0).toFixed(2),
      'Costo Neto Unitario (Bs)': Number(r.costo_neto_unidad ?? 0).toFixed(2),
      
      // Precios finales (después de incremento)
      'PRECIO CAJA (Bs)': Number(r.precio ?? r["precio final"] ?? r.precio_final_caja ?? 0).toFixed(2),
      'PRECIO FRACCIÓN (Bs)': Number(r.precio_final_unidad ?? 0).toFixed(2),
      
      // Márgenes calculados
      'Margen Caja (Bs)': Number(
        (r.precio ?? r["precio final"] ?? r.precio_final_caja ?? 0) - 
        (r["costo final"] ?? r.costo_neto_caja ?? 0)
      ).toFixed(2),
      'Margen Unitario (Bs)': Number(
        (r.precio_final_unidad ?? 0) - (r.costo_neto_unidad ?? 0)
      ).toFixed(2),
      
      // Estado y observaciones
      'Estado': (r.estado || 'pendiente').toUpperCase(),
      'Caso Especial': r.caso_especial || '',
      'Usuario': r.usuario || 'facturador'
    }));

    // Usar SheetJS para crear el Excel
    import('xlsx').then(XLSX => {
      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Crear hoja con los datos
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Configurar anchos de columna
      const colWidths = [
        { wch: 5 },   // N°
        { wch: 16 },  // Fecha
        { wch: 35 },  // Producto
        { wch: 15 },  // Proveedor
        { wch: 12 },  // Marca/Línea
        { wch: 15 },  // Código de Barras
        { wch: 12 },  // Código Ref
        { wch: 8 },   // Unidades por Caja
        { wch: 12 },  // Costo Caja
        { wch: 12 },  // Costo Unitario
        { wch: 10 },  // Descuento 1
        { wch: 10 },  // Descuento 2
        { wch: 10 },  // Incremento
        { wch: 12 },  // Parámetros Manuales
        { wch: 14 },  // Costo Neto Caja
        { wch: 14 },  // Costo Neto Unitario
        { wch: 14 },  // PRECIO CAJA
        { wch: 14 },  // PRECIO FRACCIÓN
        { wch: 12 },  // Margen Caja
        { wch: 12 },  // Margen Unitario
        { wch: 10 },  // Estado
        { wch: 12 },  // Caso Especial
        { wch: 10 }   // Usuario
      ];
      ws['!cols'] = colWidths;
      
      // Establecer formato para las celdas de encabezado
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[address]) continue;
        ws[address].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4F46E5" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }
      
      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, "Registro de Márgenes");
      
      // Crear hoja de resumen
      const resumen = [
        { 'Métrica': 'Total de productos procesados', 'Valor': bitacora.length },
        { 'Métrica': 'Productos con parámetros manuales', 'Valor': bitacora.filter(r => r.parametros_manual).length },
        { 'Métrica': 'Productos con casos especiales', 'Valor': bitacora.filter(r => r.caso_especial && r.caso_especial.toLowerCase() === 'si').length },
        { 'Métrica': 'Promedio descuento 1 (%)', 'Valor': (bitacora.reduce((sum, r) => sum + (r.desc1_pct * 100), 0) / bitacora.length).toFixed(2) },
        { 'Métrica': 'Promedio descuento 2 (%)', 'Valor': (bitacora.reduce((sum, r) => sum + (r.desc2_pct * 100), 0) / bitacora.length).toFixed(2) },
        { 'Métrica': 'Promedio incremento (%)', 'Valor': (bitacora.reduce((sum, r) => sum + (r.incremento_pct * 100), 0) / bitacora.length).toFixed(2) }
      ];
      
      const wsResumen = XLSX.utils.json_to_sheet(resumen);
      wsResumen['!cols'] = [{ wch: 35 }, { wch: 15 }];
      
      // Formato para encabezados del resumen
      ['A1', 'B1'].forEach(cell => {
        if (wsResumen[cell]) {
          wsResumen[cell].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "059669" } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
      });
      
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      
      // Crear el archivo Excel
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Descargar archivo
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FarmaClinic_Margenes_${new Date().toISOString().slice(0, 10)}_${new Date().toTimeString().slice(0, 5).replace(':', '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      alert(`✅ Excel exportado exitosamente con ${bitacora.length} registros`);
    }).catch(err => {
      console.error('Error al exportar:', err);
      alert('Error al exportar el archivo Excel');
    });
    
  } catch (error) {
    console.error('Error en exportación:', error);
    alert('Error al preparar la exportación');
  }
}

// ========================================
// 💊 MAIN COMPONENT - FARMACLINIC MARGENES
// ========================================
export default function AppMargenes() {
  // Estados principales
  const [data, setData] = useState(DEMO);
  const [query, setQuery] = useState("");
  const [proveedorFilter, setProveedorFilter] = useState("todos");
  const [lineaFilter, setLineaFilter] = useState("todas");
  const [bitacora, setBitacora] = useState([]);
  const [costosIngresados, setCostosIngresados] = useState({});
  const [theme, setTheme] = useState("dark");
  const [overrides, setOverrides] = useState({});
  
  // Estados locales para inputs mientras se editan
  const [editingInputs, setEditingInputs] = useState({});

  // toggle de netos
  const [showNetos, setShowNetos] = useState(false);

  // ========================================
  // THEME MANAGEMENT
  // ========================================
  useEffect(() => {
    const t = localStorage.getItem("fc_theme");
    if (t === "dark" || t === "light") setTheme(t);
  }, []);
  useEffect(() => {
    localStorage.setItem("fc_theme", theme);
  }, [theme]);
  const isDark = theme === "dark";
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const cn = (...xs) => xs.filter(Boolean).join(" ");

  // ========================================
  // FILTERS & SEARCH LOGIC
  // ========================================
  const proveedores = useMemo(() => {
    const s = new Set();
    data.forEach((p) => p.proveedor && s.add(p.proveedor));
    return ["todos", ...Array.from(s).sort((a, b) => a.localeCompare(b, "es"))];
  }, [data]);
  
  const lineas = useMemo(() => {
    const s = new Set();
    data.forEach((p) => p.linea && s.add(p.linea));
    return ["todas", ...Array.from(s).sort((a, b) => a.localeCompare(b, "es"))];
  }, [data]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((p) => {
      const matchQ =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.proveedor || "").toLowerCase().includes(q) ||
        (p.linea || "").toLowerCase().includes(q) ||
        (p.codigo_barras || "").toLowerCase().includes(q) ||
        (p.cod_ref || "").toLowerCase().includes(q);
      const matchProv =
        proveedorFilter === "todos" || p.proveedor === proveedorFilter;
      const matchLinea = lineaFilter === "todas" || p.linea === lineaFilter;
      return matchQ && matchProv && matchLinea;
    });
  }, [data, query, proveedorFilter, lineaFilter]);

  // ========================================
  // FILE HANDLING
  // ========================================
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isExcel =
      (f.name || "").toLowerCase().endsWith(".xlsx") ||
      (f.name || "").toLowerCase().endsWith(".xls");
    const handler = (productos) => {
      if (productos.length) setData(productos);
    };
    if (isExcel) parseXLS(f, handler);
    else parseCSV(f, handler);
  }

  // ========================================
  // BUSINESS LOGIC HANDLERS
  // ========================================
  function validarYRegistrar(p) {
    const entered = costosIngresados[p.id] || {};
    const upc =
      isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0
        ? Number(p.unidades_por_caja)
        : 1;
    const baseC = isFinite(entered.caja)
      ? Number(entered.caja)
      : p.costo_caja ?? 0;
    if (!isFinite(baseC) || baseC <= 0) {
      alert("Ingresa un costo por caja válido para registrar.");
      return;
    }
    registrarEnBitacora(p);
  }

  function registrarEnBitacora(p) {
    const entered = costosIngresados[p.id] || {};
    const upc =
      isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0
        ? Number(p.unidades_por_caja)
        : 1;
    const baseC = isFinite(entered.caja)
      ? Number(entered.caja)
      : p.costo_caja ?? 0;
    const baseU = upc > 0 ? baseC / upc : baseC;

    const ov = overrides[p.id] || {};
    const baseD1 = p.desc1_pct || 0,
      baseD2 = p.desc2_pct || 0,
      baseInc = p.incremento_pct || 0;
    const d1 = ov.d1 ?? baseD1;
    const d2 = ov.d2 ?? baseD2;
    const inc = ov.inc ?? baseInc;
    const isManual = ov.d1 != null || ov.d2 != null || ov.inc != null;

    const netoU = aplicarDescuentosProveedor(baseU, d1, d2);
    const netoC = aplicarDescuentosProveedor(baseC, d1, d2);

    const finalU = netoU * (1 + inc);
    const finalC = netoC * (1 + inc);

    const row = {
      fecha: new Date().toISOString(),
      producto: p.nombre,
      proveedor: p.proveedor,
      linea: p.linea || "",
      codigo_barras: p.codigo_barras || "",
      cod_ref: p.cod_ref || "",
      unidades_por_caja: upc,
      costo_caja_ingresado: isFinite(entered.caja) ? Number(entered.caja) : "",
      desc1_pct: d1,
      desc2_pct: d2,
      incremento_pct: inc,
      desc1_pct_base: baseD1,
      desc2_pct_base: baseD2,
      incremento_pct_base: baseInc,
      desc1_pct_manual: ov.d1 ?? null,
      desc2_pct_manual: ov.d2 ?? null,
      incremento_pct_manual: ov.inc ?? null,
      parametros_manual: isManual,
      costo_neto_unidad: netoU,
      costo_neto_caja: netoC,
      precio_final_unidad: finalU,
      precio_final_caja: finalC,
      costo: baseC,
      "costo final": netoC,
      precio: finalC,
      "precio final": finalC,
      estado: "validado",
      caso_especial: p.caso_especial || "",
      usuario: "facturador",
    };
    setBitacora((prev) => [...prev, row]);
  }

  function copiarResumen(p) {
    const ov = overrides[p.id] || {};
    const entered = costosIngresados[p.id] || {};
    const upc =
      isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0
        ? Number(p.unidades_por_caja)
        : 1;

    const baseC = isFinite(entered.caja)
      ? Number(entered.caja)
      : p.costo_caja ?? 0;
    const baseU = upc > 0 ? baseC / upc : baseC;

    const baseD1 = p.desc1_pct || 0,
      baseD2 = p.desc2_pct || 0,
      baseInc = p.incremento_pct || 0;
    const d1 = ov.d1 ?? baseD1;
    const d2 = ov.d2 ?? baseD2;
    const inc = ov.inc ?? baseInc;

    const netoU = aplicarDescuentosProveedor(baseU, d1, d2);
    const netoC = aplicarDescuentosProveedor(baseC, d1, d2);

    const finalU = netoU * (1 + inc);
    const finalC = netoC * (1 + inc);

    const texto = [
      `Producto: ${p.nombre}`,
      `Proveedor: ${p.proveedor}`,
      `Marca/Línea: ${p.linea ?? "-"}`,
      `Código de barras: ${p.codigo_barras ?? "-"}`,
      `Cod ref: ${p.cod_ref ?? "-"}`,
      `Unid/Caja: ${upc}`,
      `Costo Caja: Bs ${nf.format(baseC)} | Costo U: Bs ${nf.format(baseU)}`,
      `Desc. prov: ${pf(d1)} + ${pf(d2)} (cascada) | Inc.: ${pf(inc)}`,
      `Neto Caja: Bs ${nf.format(netoC)} | Neto U: Bs ${nf.format(netoU)}`,
      `Final Caja: Bs ${nf.format(finalC)} | Final U: Bs ${nf.format(finalU)}`,
    ].join("\n");
    navigator.clipboard.writeText(texto);
  }

  // ========================================
  // STYLING CONSTANTS
  // ========================================
  const wrapperClass = cn(
    "min-h-screen w-full relative overflow-hidden",
    isDark ? "text-slate-100" : "text-slate-800"
  );
  
  // Mejores gradientes y efectos visuales
  const bgMain = isDark ? (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1c] via-[#0e1627] to-[#020617]" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-[80vmax] w-[80vmax] rounded-full blur-[120px] opacity-50 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.4),_transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[80vmax] w-[80vmax] rounded-full blur-[120px] opacity-40 bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.35),_transparent_60%)]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vmax] w-[60vmax] rounded-full blur-[100px] opacity-20 bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.25),_transparent_70%)]" />
    </>
  ) : (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-[80vmax] w-[80vmax] rounded-full blur-[120px] opacity-70 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.3),_transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[80vmax] w-[80vmax] rounded-full blur-[120px] opacity-60 bg-[radial-gradient(circle_at_center,_rgba(147,51,234,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vmax] w-[60vmax] rounded-full blur-[100px] opacity-30 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.2),_transparent_70%)]" />
    </>
  );

  const cardClass = cn(
    "rounded-3xl backdrop-blur-xl border-2 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl",
    isDark
      ? "shadow-2xl shadow-indigo-950/40 border-white/20 bg-gradient-to-br from-white/15 to-white/5"
      : "shadow-xl shadow-slate-400/20 border-slate-300/50 bg-gradient-to-br from-white/90 to-slate-50/80"
  );

  // Estilos mejorados para precios destacados
  const priceFinalClass = cn(
    "font-bold tabular-nums text-2xl md:text-3xl tracking-tight drop-shadow-lg",
    isDark 
      ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300" 
      : "text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600"
  );

  const priceNetClass = cn(
    "font-semibold tabular-nums text-lg md:text-xl tracking-tight",
    isDark ? "text-amber-300" : "text-amber-600"
  );

  // inputs nativos (mejorados visualmente)
  const hardInput = {
    all: "unset",
    boxSizing: "border-box",
    display: "block",
    width: "100%",
    minWidth: "4.5rem",
    height: "2rem",
    padding: "0.5rem 0.75rem",
    textAlign: "right",
    fontSize: "0.875rem",
    fontWeight: "500",
    lineHeight: 1.2,
    borderRadius: "0.75rem",
    border: isDark
      ? "2px solid rgba(255,255,255,0.15)"
      : "2px solid rgba(15,23,42,0.25)",
    background: isDark 
      ? "rgba(255,255,255,0.08)" 
      : "rgba(255,255,255,0.95)",
    color: isDark ? "#F1F5F9" : "#0f172a",
    WebkitTextFillColor: isDark ? "#F1F5F9" : "#0f172a",
    caretColor: isDark ? "#F1F5F9" : "#0f172a",
    outline: "none",
    transition: "all 0.2s ease",
    boxShadow: isDark 
      ? "0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" 
      : "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
  };

  const costInputStyle = {
    ...hardInput,
    fontSize: "1rem",
    fontWeight: "600",
    height: "2.5rem",
    background: isDark 
      ? "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))"
      : "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.03))",
    border: isDark
      ? "2px solid rgba(99,102,241,0.3)"
      : "2px solid rgba(99,102,241,0.2)",
  };

  // ========================================
  // JSX RENDER - MAIN UI
  // ========================================
  return (
    <div className={wrapperClass}>
      {/* override global */}
      <style>{`
        input, input[type="text"], input[type="number"]{
          color: inherit !important;
          -webkit-text-fill-color: inherit !important;
          caret-color: currentColor !important;
          opacity: 1 !important;
        }
        
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 30px rgba(99,102,241,0.5); }
        }
        
        .price-highlight {
          animation: pulseGlow 2s ease-in-out infinite;
        }
        
        .card-hover:hover {
          transform: translateY(-2px) scale(1.005);
        }
      `}</style>

      {bgMain}

      <div className="relative mx-auto max-w-screen-2xl p-4 md:p-6 space-y-6">
        {/* ========================================
            HEADER SECTION
        ======================================== */}
        <header className="group flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className={cn(
                "text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent drop-shadow-2xl",
                isDark
                  ? "bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300"
                  : "bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-cyan-600"
              )}
            >
              💊 Módulo de Márgenes
            </h1>
            <p
              className={cn(
                "mt-2 text-lg font-medium",
                isDark ? "text-slate-300/90" : "text-slate-600"
              )}
            >
              Descuentos de proveedor en cascada + incremento.{" "}
              <span
                className={cn(
                  "font-bold",
                  isDark ? "text-emerald-300" : "text-emerald-600"
                )}
              >
                Sistema de Facturación Profesional
              </span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div style={{ fontSize: 14, opacity: 0.9 }} className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Build: <b>PRO-UX V8.2</b> - d1/d2 COPIA EXACTA de Inc (que funciona) 🔄
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ÚNICO control de importación */}
            <label
              className={cn(
                "inline-flex items-center gap-3 text-sm px-4 py-3 rounded-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer",
                isDark
                  ? "bg-white/10 border-2 border-white/20 shadow-2xl shadow-indigo-950/30 hover:bg-white/15 hover:shadow-indigo-500/30"
                  : "bg-white/90 border-2 border-slate-300 shadow-xl hover:bg-slate-50 hover:shadow-slate-400/40"
              )}
            >
              <FileUp className="h-5 w-5" />
              <span className="font-semibold">Importar CSV/XLSX</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={onFile}
                className="hidden"
              />
            </label>
            <Button
              onClick={() => exportBitacora(bitacora)}
              disabled={bitacora.length === 0}
              className={cn(
                "rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 px-4 py-3",
                bitacora.length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : isDark
                  ? "bg-emerald-600/80 hover:bg-emerald-600 border-2 border-emerald-500 backdrop-blur-xl text-white shadow-2xl shadow-emerald-900/50"
                  : "bg-emerald-600 hover:bg-emerald-700 border-2 border-emerald-500 text-white shadow-xl shadow-emerald-500/30"
              )}
            >
              <FileDown className="h-5 w-5 mr-2" /> 
              📊 Exportar Excel ({bitacora.length})
            </Button>
            <Button
              onClick={toggleTheme}
              aria-pressed={isDark}
              className="rounded-2xl text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-fuchsia-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-fuchsia-500 shadow-2xl border-0 transition-all duration-300 hover:-translate-y-1 hover:scale-105 px-4 py-3"
            >
              {isDark ? (
                <>
                  <Sun className="h-5 w-5 mr-2" /> Claro
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5 mr-2" /> Oscuro
                </>
              )}
            </Button>
          </div>
        </header>

        {/* ========================================
            FILTERS SECTION
        ======================================== */}
        <Card className={cardClass}>
          <CardHeader className="pb-3 sticky top-0 z-10 backdrop-blur-xl">
            <CardTitle
              className={cn(
                "text-xl font-bold flex items-center gap-2",
                isDark ? "text-slate-100" : "text-slate-800"
              )}
            >
              <Search className="h-5 w-5" />
              Buscar y filtrar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:grid md:grid-cols-12 md:items-center">
            <div className="relative md:col-span-6">
              <Search
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5",
                  isDark ? "text-slate-300" : "text-slate-500"
                )}
              />
              <input
                type="text"
                placeholder="Buscar por producto, proveedor, marca/línea, código de barras o código ref"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ 
                  ...hardInput, 
                  textAlign: "left", 
                  paddingLeft: "3rem",
                  height: "3rem",
                  fontSize: "1rem"
                }}
                autoComplete="off"
              />
            </div>

            <div className="md:col-span-3">
              <Select
                value={proveedorFilter}
                onValueChange={setProveedorFilter}
              >
                <SelectTrigger
                  className={cn(
                    "w-full rounded-2xl h-12 text-base font-medium",
                    isDark
                      ? "bg-white/10 border-2 border-white/20 text-slate-100"
                      : "bg-white/90 border-2 border-slate-300 text-slate-800"
                  )}
                >
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent
                  className={
                    isDark
                      ? "bg-slate-900/95 border-2 border-white/20 text-slate-100 backdrop-blur-xl"
                      : "bg-white/95 border-2 border-slate-300 text-slate-800 backdrop-blur-xl"
                  }
                >
                  {proveedores.map((p) => (
                    <SelectItem
                      key={p}
                      value={p}
                      className={cn(
                        "focus:bg-white/15 font-medium",
                        !isDark && "focus:bg-slate-100"
                      )}
                    >
                      {p === "todos" ? "Todos los proveedores" : p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Select value={lineaFilter} onValueChange={setLineaFilter}>
                <SelectTrigger
                  className={cn(
                    "w-full rounded-2xl h-12 text-base font-medium",
                    isDark
                      ? "bg-white/10 border-2 border-white/20 text-slate-100"
                      : "bg-white/90 border-2 border-slate-300 text-slate-800"
                  )}
                >
                  <SelectValue placeholder="Marca/Línea" />
                </SelectTrigger>
                <SelectContent
                  className={
                    isDark
                      ? "bg-slate-900/95 border-2 border-white/20 text-slate-100 backdrop-blur-xl"
                      : "bg-white/95 border-2 border-slate-300 text-slate-800 backdrop-blur-xl"
                  }
                >
                  {lineas.map((l) => (
                    <SelectItem
                      key={l}
                      value={l}
                      className={cn(
                        "focus:bg-white/15 font-medium",
                        !isDark && "focus:bg-slate-100"
                      )}
                    >
                      {l === "todas" ? "Todas las marcas/líneas" : l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle de Netos */}
            <div className="md:col-span-12 flex flex-wrap gap-3 pt-2">
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "rounded-xl px-4 py-2 font-semibold transition-all duration-300 hover:scale-105",
                  showNetos 
                    ? isDark 
                      ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/30" 
                      : "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200"
                    : isDark
                      ? "bg-white/10 border-white/20 hover:bg-white/15"
                      : "bg-white border-slate-300 hover:bg-slate-50"
                )}
                onClick={() => setShowNetos((v) => !v)}
              >
                <ListFilter className="h-4 w-4 mr-2" />
                {showNetos ? "Ocultar Netos" : "Ver Netos"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ========================================
            PRODUCTS SECTION
        ======================================== */}
        <div className="space-y-6">
          {filtrados.map((p) => {
            const entered = costosIngresados[p.id] || {};
            const upc =
              isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0
                ? Number(p.unidades_por_caja)
                : 1;

            const baseC = isFinite(entered.caja)
              ? Number(entered.caja)
              : p.costo_caja ?? 0;
            const baseU = upc > 0 ? baseC / upc : baseC;

            const ov = overrides[p.id] || {};
            const baseD1 = p.desc1_pct || 0;
            const baseD2 = p.desc2_pct || 0;
            const baseInc = p.incremento_pct || 0;
            const d1 = ov.d1 ?? baseD1;
            const d2 = ov.d2 ?? baseD2;
            const inc = ov.inc ?? baseInc;
            const isManual = ov.d1 != null || ov.d2 != null || ov.inc != null;

            const netoC = aplicarDescuentosProveedor(baseC, d1, d2);
            const finalC = netoC * (1 + inc);
            const netoU = aplicarDescuentosProveedor(baseU, d1, d2);
            const finalU = netoU * (1 + inc);

            const caso = (p.caso_especial || "")
              .toString()
              .trim()
              .toLowerCase();

            return (
              <Card key={p.id} className={cn(cardClass, "card-hover")}>
                <CardContent className="p-5 md:p-6">
                  {/* Cabecera del item */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <div
                        className="font-bold text-lg md:text-xl leading-tight line-clamp-2 mb-2"
                        title={p.nombre}
                      >
                        <Package className="inline h-5 w-5 mr-2" />
                        {p.nombre}
                      </div>
                      <div
                        className={cn(
                          "text-sm opacity-90 truncate max-w-full mb-2",
                          isDark ? "text-slate-300" : "text-slate-600"
                        )}
                      >
                        📊 EAN: {p.codigo_barras || "-"} · Ref: {p.cod_ref || "-"}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={cn(
                            "inline-block truncate px-3 py-1.5 rounded-full text-sm font-semibold",
                            isDark
                              ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 text-indigo-200"
                              : "bg-gradient-to-r from-indigo-100 to-purple-100 border border-indigo-300 text-indigo-700"
                          )}
                          title={p.proveedor || "-"}
                        >
                          🏢 {p.proveedor || "-"}
                        </span>
                        <span
                          className={cn(
                            "text-sm opacity-90 px-2 py-1 rounded-lg",
                            isDark 
                              ? "bg-white/10 text-slate-300" 
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          🏷️ {p.linea || "-"}
                        </span>
                        {isManual && (
                          <span
                            className={cn(
                              "text-sm px-3 py-1 rounded-full font-bold animate-pulse",
                              isDark
                                ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-200 border border-amber-400/50"
                                : "bg-gradient-to-r from-amber-200 to-orange-200 text-amber-800 border border-amber-400"
                            )}
                          >
                            ✏️ MANUAL
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Caso especial chip mejorado */}
                    <div className="shrink-0">
                      {(function (estado) {
                        const base =
                          "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-all duration-300 hover:scale-105 ";
                        if ((estado || "").toLowerCase() === "si")
                          return (
                            <span
                              className={
                                base +
                                (isDark
                                  ? "bg-gradient-to-r from-rose-500/30 to-red-500/30 text-rose-200 shadow-rose-900/50 border border-rose-400/50"
                                  : "bg-gradient-to-r from-rose-200 to-red-200 text-rose-800 shadow-rose-300 border border-rose-400")
                              }
                            >
                              <AlertCircle className="h-4 w-4" /> CASO ESPECIAL
                            </span>
                          );
                        if ((estado || "").toLowerCase() === "consultar")
                          return (
                            <span
                              className={
                                base +
                                (isDark
                                  ? "bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-200 shadow-amber-900/50 border border-amber-400/50"
                                  : "bg-gradient-to-r from-amber-200 to-yellow-200 text-amber-800 shadow-amber-300 border border-amber-400")
                              }
                            >
                              <Info className="h-4 w-4" /> CONSULTAR
                            </span>
                          );
                        return (
                          <span
                            className={
                              base +
                              (isDark
                                ? "bg-gradient-to-r from-emerald-500/30 to-green-500/30 text-emerald-200 shadow-emerald-900/50 border border-emerald-400/50"
                                : "bg-gradient-to-r from-emerald-200 to-green-200 text-emerald-800 shadow-emerald-300 border border-emerald-400")
                            }
                          >
                            <CheckCircle2 className="h-4 w-4" /> OK
                          </span>
                        );
                      })(caso)}
                    </div>
                  </div>

                  {/* GRID de edición y resultados mejorado */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Bloque de inputs mejorado */}
                    <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                      {/* Costo Caja - MAS DESTACADO */}
                      <div className={cn(
                        "p-4 rounded-2xl border-2",
                        isDark 
                          ? "bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-400/30"
                          : "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300"
                      )}>
                        <div className="text-sm font-bold mb-2 flex items-center gap-2">
                          💰 Costo por Caja
                        </div>
                        <div
                          className="flex rounded-xl overflow-hidden border-2"
                          style={{
                            borderColor: isDark
                              ? "rgba(99,102,241,0.4)"
                              : "rgba(99,102,241,0.3)",
                          }}
                        >
                          <span
                            className={cn(
                              "px-3 inline-flex items-center text-sm font-bold",
                              isDark 
                                ? "bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-200" 
                                : "bg-gradient-to-r from-indigo-200 to-purple-200 text-indigo-800"
                            )}
                          >
                            Bs
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            autoComplete="off"
                            value={
                              costosIngresados[p.id]?.caja === undefined ||
                              costosIngresados[p.id]?.caja === null
                                ? p.costo_caja ?? ""
                                : String(costosIngresados[p.id]?.caja ?? "")
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              // Permitir números con coma o punto decimal y espacios
                              if (raw === "" || /^[\d\s.,]*$/.test(raw)) {
                                setCostosIngresados((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    caja: raw === "" ? undefined : raw,
                                  },
                                }));
                              }
                            }}
                            onBlur={(e) => {
                              // Convertir a número al perder el foco
                              const raw = e.target.value;
                              if (raw !== "") {
                                const numValue = numBO(raw);
                                if (numValue !== undefined) {
                                  setCostosIngresados((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      caja: numValue,
                                    },
                                  }));
                                }
                              }
                            }}
                            title="Costo por Caja - Acepta: 123.45, 123,45, 1.234,56"
                            style={costInputStyle}
                          />
                        </div>
                        <div
                          className={cn(
                            "text-sm mt-2 opacity-90 tabular-nums font-medium",
                            isDark ? "text-emerald-300" : "text-emerald-600"
                          )}
                        >
                          💊 Costo Unitario: Bs {nf.format(baseU)} (x{upc} unidades)
                        </div>
                      </div>

                      {/* Descuentos e incremento */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-sm font-semibold mb-2">📉 d1 %</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9.,%]*"
                            autoComplete="off"
                            value={pctDisplay(overrides[p.id]?.d1, p.desc1_pct, overrides[p.id]?.d1_temp)}
                            onChange={(e) => {
                              const dec = parsePercentInput(e.target.value);
                              setOverrides((prev) => {
                                const next = { ...(prev[p.id] || {}) };
                                if (dec === undefined) delete next.d1;
                                else if (dec !== null) next.d1 = dec;
                                return { ...prev, [p.id]: next };
                              });
                            }}
                            onBlur={(e) => {
                              const dec = parsePercentInput(e.target.value);
                              if (dec !== null && dec !== undefined) {
                                // Mostrar como porcentaje en el display
                                e.target.value = String(Math.round(dec * 100 * 100) / 100);
                              }
                            }}
                            title="d1 (proveedor) %"
                            style={hardInput}
                          />
                        </div>

                        <div>
                          <div className="text-sm font-semibold mb-2">📉 d2 %</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9.,%]*"
                            autoComplete="off"
                            value={pctDisplay(overrides[p.id]?.d2, p.desc2_pct)}
                            onChange={(e) => {
                              const dec = parsePercentInput(e.target.value);
                              setOverrides((prev) => {
                                const next = { ...(prev[p.id] || {}) };
                                if (dec === undefined) delete next.d2;
                                else if (dec !== null) next.d2 = dec;
                                return { ...prev, [p.id]: next };
                              });
                            }}
                            onBlur={(e) => {
                              const dec = parsePercentInput(e.target.value);
                              if (dec !== null && dec !== undefined) {
                                // Mostrar como porcentaje en el display
                                e.target.value = String(Math.round(dec * 100 * 100) / 100);
                              }
                            }}
                            title="d2 (proveedor) %"
                            style={hardInput}
                          />
                        </div>

                        <div>
                          <div className="text-sm font-semibold mb-2">📈 Inc. %</div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1000"
                            placeholder="0"
                            value={
                              // Si está editando, usar valor local; si no, usar valor calculado
                              editingInputs[`${p.id}_inc`] !== undefined
                                ? editingInputs[`${p.id}_inc`]
                                : overrides[p.id]?.inc !== undefined 
                                  ? overrides[p.id].inc * 100
                                  : p.incremento_pct 
                                    ? p.incremento_pct * 100
                                    : ''
                            }
                            onFocus={(e) => {
                              // Al hacer foco, guardar valor actual en estado local
                              const currentValue = overrides[p.id]?.inc !== undefined 
                                ? overrides[p.id].inc * 100
                                : p.incremento_pct 
                                  ? p.incremento_pct * 100
                                  : '';
                              
                              setEditingInputs(prev => ({
                                ...prev,
                                [`${p.id}_inc`]: currentValue
                              }));
                            }}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Actualizar solo el estado local mientras escribe
                              setEditingInputs(prev => ({
                                ...prev,
                                [`${p.id}_inc`]: value
                              }));
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              
                              // Al perder foco, actualizar el estado principal y limpiar local
                              if (value === '') {
                                setOverrides((prev) => {
                                  const next = { ...(prev[p.id] || {}) };
                                  delete next.inc;
                                  return { ...prev, [p.id]: next };
                                });
                              } else {
                                const percent = parseFloat(value);
                                if (!isNaN(percent)) {
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      ...(prev[p.id] || {}),
                                      inc: percent / 100
                                    }
                                  }));
                                }
                              }
                              
                              // Limpiar estado local
                              setEditingInputs(prev => {
                                const next = { ...prev };
                                delete next[`${p.id}_inc`];
                                return next;
                              });
                            }}
                            title="Incremento en porcentaje (ej: 25.5 para 25.5%)"
                            style={hardInput}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloque de resultados CAJA - MAS DESTACADO */}
                    <div className={cn(
                      "lg:col-span-3 xl:col-span-4 p-4 rounded-2xl border-2",
                      isDark
                        ? "bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-400/30"
                        : "bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-300"
                    )}>
                      <div className="text-sm font-bold mb-3 flex items-center gap-2">
                        📦 Precios por Caja
                      </div>
                      <div className="space-y-3">
                        {showNetos && (
                          <div>
                            <div className="text-sm opacity-90 mb-1">Neto Caja</div>
                            <div className={cn(priceNetClass, "drop-shadow-md")}>
                              Bs {nf.format(netoC)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-sm opacity-90 mb-1 flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            Final Caja
                          </div>
                          <div className={cn(priceFinalClass, "price-highlight")}>
                            Bs {nf.format(finalC)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bloque de resultados UNIDAD - MAS DESTACADO */}
                    <div className={cn(
                      "lg:col-span-3 xl:col-span-4 p-4 rounded-2xl border-2",
                      isDark
                        ? "bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-400/30"
                        : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300"
                    )}>
                      <div className="text-sm font-bold mb-3 flex items-center gap-2">
                        💊 Precios Unitarios
                      </div>
                      <div className="space-y-3">
                        {showNetos && (
                          <div>
                            <div className="text-sm opacity-90 mb-1">Neto Unitario</div>
                            <div className={cn(priceNetClass, "drop-shadow-md")}>
                              Bs {nf.format(netoU)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-sm opacity-90 mb-1 flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            Final Unitario
                          </div>
                          <div className={cn(priceFinalClass, "price-highlight")}>
                            Bs {nf.format(finalU)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones mejoradas */}
                  <div className="mt-6 flex items-center gap-3 flex-wrap justify-center lg:justify-end">
                    <Button
                      size="lg"
                      className="rounded-2xl text-white bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-500 hover:via-green-500 hover:to-teal-500 shadow-2xl shadow-emerald-900/50 border-0 px-6 py-3 font-bold transition-all duration-300 hover:scale-105"
                      onClick={() => validarYRegistrar(p)}
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" /> ✅ Validar y Registrar
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className={cn(
                        "rounded-2xl px-6 py-3 font-semibold transition-all duration-300 hover:scale-105",
                        isDark
                          ? "bg-white/10 border-2 border-white/20 text-slate-100 hover:bg-white/15 shadow-lg"
                          : "bg-white/90 border-2 border-slate-300 text-slate-800 hover:bg-slate-50 shadow-lg"
                      )}
                      onClick={() => copiarResumen(p)}
                    >
                      <ClipboardCopy className="h-5 w-5 mr-2" /> 📋 Copiar
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className={cn(
                        "rounded-2xl px-6 py-3 font-semibold transition-all duration-300 hover:scale-105",
                        isDark
                          ? "bg-amber-500/10 border-2 border-amber-400/30 text-amber-200 hover:bg-amber-500/20 shadow-lg"
                          : "bg-amber-50 border-2 border-amber-300 text-amber-700 hover:bg-amber-100 shadow-lg"
                      )}
                      disabled={!isManual}
                      onClick={() => {
                        setOverrides((prev) => {
                          const n = { ...prev };
                          delete n[p.id];
                          return n;
                        });
                      }}
                    >
                      🔄 Restaurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filtrados.length === 0 && (
            <Card className={cardClass}>
              <CardContent
                className={cn(
                  "text-center py-12",
                  isDark ? "text-slate-300" : "text-slate-600"
                )}
              >
                <div className="text-6xl mb-4">🔍</div>
                <div className="text-xl font-semibold mb-2">Sin resultados</div>
                <div className="text-base">Ajusta tu búsqueda o carga tu archivo CSV/XLSX</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ========================================
            TRANSACTION HISTORY SECTION
        ======================================== */}
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle
              className={cn(
                "text-xl font-bold flex items-center gap-3",
                isDark ? "text-slate-100" : "text-slate-800"
              )}
            >
              📊 Historial de transacciones 
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-bold",
                isDark 
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-200"
                  : "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700"
              )}>
                {bitacora.length} registros
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bitacora.length === 0 ? (
              <div
                className={cn(
                  "text-center py-12",
                  isDark ? "text-slate-300" : "text-slate-600"
                )}
              >
                <div className="text-6xl mb-4">📝</div>
                <div className="text-xl font-semibold mb-2">Historial vacío</div>
                <div className="text-base">
                  Ingresa costos por caja y valida productos para comenzar a registrar transacciones.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {bitacora
                  .slice()
                  .reverse()
                  .map((r, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-4 rounded-2xl border-2 flex flex-col gap-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
                        isDark
                          ? "bg-gradient-to-br from-white/10 to-white/5 border-white/20"
                          : "bg-gradient-to-br from-white to-slate-50/80 border-slate-300"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-bold text-lg mb-1 flex items-center gap-2">
                            📦 {r.producto}
                          </div>
                          <div
                            className={cn(
                              "text-sm opacity-90 mb-2",
                              isDark ? "text-slate-300" : "text-slate-600"
                            )}
                          >
                            🏢 {r.proveedor || "-"} · 🏷️ {r.linea || "-"} · 
                            📊 EAN: {r.codigo_barras || "-"} · Ref: {r.cod_ref || "-"}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-lg font-medium",
                                isDark ? "bg-white/10" : "bg-slate-100"
                              )}
                            >
                              📅 {new Date(r.fecha).toLocaleString()}
                            </span>
                            <span
                              className={cn(
                                "px-3 py-1 rounded-full font-bold text-sm",
                                (r.estado || "").toLowerCase() === "validado"
                                  ? isDark
                                    ? "bg-gradient-to-r from-emerald-500/30 to-green-500/30 text-emerald-200 border border-emerald-400/50"
                                    : "bg-gradient-to-r from-emerald-200 to-green-200 text-emerald-800 border border-emerald-400"
                                  : isDark
                                  ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-200 border border-amber-400/50"
                                  : "bg-gradient-to-r from-amber-200 to-orange-200 text-amber-800 border border-amber-400"
                              )}
                            >
                              {(r.estado || "pendiente").toUpperCase() === "VALIDADO" ? "✅ VALIDADO" : "⏳ PENDIENTE"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right space-y-2">
                          <div className="grid grid-cols-1 gap-2">
                            <div className={cn(
                              "px-3 py-2 rounded-xl",
                              isDark ? "bg-blue-500/20 border border-blue-400/30" : "bg-blue-50 border border-blue-200"
                            )}>
                              <div className="text-xs opacity-80 mb-1">💰 Costo</div>
                              <div className="font-bold tabular-nums text-lg">
                                Bs {nf.format(r.costo ?? r.costo_caja_ingresado ?? 0)}
                              </div>
                            </div>
                            <div className={cn(
                              "px-3 py-2 rounded-xl",
                              isDark ? "bg-amber-500/20 border border-amber-400/30" : "bg-amber-50 border border-amber-200"
                            )}>
                              <div className="text-xs opacity-80 mb-1">🧮 Costo Final</div>
                              <div className="font-bold tabular-nums text-lg">
                                Bs {nf.format(r["costo final"] ?? r.costo_neto_caja ?? 0)}
                              </div>
                            </div>
                            <div className={cn(
                              "px-3 py-2 rounded-xl",
                              isDark ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/30" : "bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200"
                            )}>
                              <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                Precio Final
                              </div>
                              <div className="font-bold tabular-nums text-xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600">
                                Bs {nf.format(
                                  r.precio ??
                                    r["precio final"] ??
                                    r.precio_final_caja ??
                                    0
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========================================
            FOOTER SECTION
        ======================================== */}
        <footer
          className={cn(
            "text-center py-8 space-y-2",
            isDark ? "text-slate-300" : "text-slate-600"
          )}
        >
          <div className="text-2xl">💊</div>
          <div className="text-sm font-semibold">
            FarmaClinic · Módulo de Márgenes · {new Date().getFullYear()}
          </div>
          <div className="text-xs opacity-75">
            Sistema Profesional de Gestión de Precios Farmacéuticos
          </div>
        </footer>
      </div>
    </div>
  );
}
