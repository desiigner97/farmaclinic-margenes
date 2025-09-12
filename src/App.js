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
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { createClient } from "@supabase/supabase-js";

// ───────────────────────────────────────────────────────────────────────────────
// Configuración de Supabase (ojo: usa una anon key pública)
// ───────────────────────────────────────────────────────────────────────────────
const supabaseUrl = "https://qavzzmdxprkimtlrbmjw.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdnp6bWR4cHJraW10bHJibWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MDcxOTAsImV4cCI6MjA3MzI4MzE5MH0.qN4CfWzeh2HhtJGzP9lgAlf3lDzZODmz2N-EcMyuOUo";
const supabase = createClient(supabaseUrl, supabaseKey);

/** =======================
 *  FarmaClinic · Márgenes
 *  PRO-UX V8.2
 *  - Vista en tarjetas sin scroll horizontal.
 *  - Estado local de inputs para edición cómoda.
 *  ======================= */

// ───────────────────────────────────────────────────────────────────────────────
// 🎨 FORMATTERS & NUMBER UTILITIES
// ───────────────────────────────────────────────────────────────────────────────
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
  const numValue = parseFloat(String(raw).replace(",", ".").trim());
  if (!Number.isFinite(numValue)) return null;
  // Si >= 1, se interpreta como porcentaje (25 -> 0.25)
  return numValue >= 1 ? numValue / 100 : numValue;
}

function pctDisplay(overrideVal, baseVal) {
  const candidate = overrideVal ?? baseVal;
  if (candidate == null) return "";
  const percentage = Number(candidate) * 100;
  if (!Number.isFinite(percentage)) return "";
  return String(Math.round(percentage * 100) / 100);
}

// ───────────────────────────────────────────────────────────────────────────────
// 📊 DEMO DATA
// ───────────────────────────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────────────────────────
// 🔄 HEADER NORMALIZATION
// ───────────────────────────────────────────────────────────────────────────────
function normalizarCabecera(c) {
  const s = (c || "").toString().trim().toLowerCase();
  if (["producto", "nombre", "nombre producto", "nombre_producto", "nombre product"].includes(s)) return "nombre";
  if (["proveedor", "vendor", "supplier"].includes(s)) return "proveedor";
  if (["linea", "línea", "linea de producto", "familia", "categoria", "categoría"].includes(s)) return "linea";
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
  if (["costo_caja", "costo caja", "box_cost", "costo/pack", "costo master"].includes(s)) return "costo_caja";
  if (["costo_unitario", "costo unit", "unit_cost", "costo/u", "costo unidad"].includes(s)) return "costo_unitario";
  if (["costo", "precio costo", "cost", "precio_costo"].includes(s)) return "costo";
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
  if (["caso especial?", "caso especial", "especial?", "alerta", "alertas", "alertas proveedor"].includes(s))
    return "caso_especial";
  if (["cod barras", "codigo de barras", "código de barras", "barcode", "ean", "ean13"].includes(s))
    return "codigo_barras";
  if (["cod ref", "cod_ref", "codigo ref", "código ref", "ref"].includes(s)) return "cod_ref";
  if (["id", "codigo", "código", "sku"].includes(s)) return s;

  const hasDescuento = s.includes("descuento") || s.includes("desc");
  if ((hasDescuento || s.includes("d1")) && s.includes("1")) return "desc1_pct";
  if ((hasDescuento || s.includes("d2")) && s.includes("2")) return "desc2_pct";
  if (s.includes("incremento") || s.includes("margen") || s.includes("markup") || s.startsWith("inc ") || s.includes(" inc") || s.includes("inc%"))
    return "incremento_pct";
  return s;
}

// ───────────────────────────────────────────────────────────────────────────────
// 🔄 FILE PARSERS (CSV/XLSX)
// ───────────────────────────────────────────────────────────────────────────────
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

        const codigo_barras = (obj.codigo_barras ?? "").toString().trim() || undefined;
        const cod_ref = (obj.cod_ref ?? "").toString().trim() || undefined;
        const id = (
          codigo_barras ||
          cod_ref ||
          obj.id ||
          (crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
        ).toString();

        const nombre = (obj.nombre ?? "").toString();
        const proveedor = (obj.proveedor ?? "").toString();
        const linea = (obj.linea ?? obj.marca ?? "").toString();
        const marca = (obj.marca ?? "").toString();

        let unidades_por_caja = numBO(obj.unidades_por_caja);
        if (!isFinite(unidades_por_caja) || unidades_por_caja <= 0) unidades_por_caja = 1;

        let costo_caja = numBO(obj.costo_caja);
        const cu = numBO(obj.costo_unitario),
          cc = numBO(obj.costo);
        if (costo_caja == null && isFinite(cu)) costo_caja = Number(cu) * unidades_por_caja;
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

      const codigo_barras = (obj.codigo_barras ?? "").toString().trim() || undefined;
      const cod_ref = (obj.cod_ref ?? "").toString().trim() || undefined;
      const id = (
        codigo_barras ||
        cod_ref ||
        obj.id ||
        (crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      ).toString();

      const nombre = (obj.nombre ?? "").toString();
      const proveedor = (obj.proveedor ?? "").toString();
      const linea = (obj.linea ?? obj.marca ?? "").toString();
      const marca = (obj.marca ?? "").toString();

      let unidades_por_caja = numBO(obj.unidades_por_caja);
      if (!isFinite(unidades_por_caja) || unidades_por_caja <= 0) unidades_por_caja = 1;

      let costo_caja = numBO(obj.costo_caja);
      const cu = numBO(obj.costo_unitario),
        cc = numBO(obj.costo);
      if (costo_caja == null && isFinite(cu)) costo_caja = Number(cu) * unidades_por_caja;
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

// ───────────────────────────────────────────────────────────────────────────────
function aplicarDescuentosProveedor(c, d1 = 0, d2 = 0) {
  const D1 = Math.min(Math.max(Number(d1) || 0, 0), 1);
  const D2 = Math.min(Math.max(Number(d2) || 0, 0), 1);
  return Number(c || 0) * (1 - D1) * (1 - D2);
}

// ───────────────────────────────────────────────────────────────────────────────
// 📤 EXPORT A EXCEL
// ───────────────────────────────────────────────────────────────────────────────
function exportBitacora(bitacora) {
  if (!bitacora.length) {
    alert("No hay registros para exportar");
    return;
  }

  try {
    const excelData = bitacora.map((r, index) => ({
      "N°": index + 1,
      Fecha: new Date(r.fecha).toLocaleString("es-BO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      Producto: r.producto || "",
      Proveedor: r.proveedor || "",
      "Marca/Línea": r.linea || "",
      "Código de Barras": r.codigo_barras || "",
      "Código Ref": r.cod_ref || "",
      "Unidades por Caja": r.unidades_por_caja || 1,
      "Costo Caja (Bs)": Number(r.costo ?? r.costo_caja_ingresado ?? 0).toFixed(2),
      "Costo Unitario (Bs)": Number(
        (r.costo ?? r.costo_caja_ingresado ?? 0) / (r.unidades_por_caja || 1)
      ).toFixed(2),
      "Descuento 1 (%)": Number((r.desc1_pct ?? 0) * 100).toFixed(2),
      "Descuento 2 (%)": Number((r.desc2_pct ?? 0) * 100).toFixed(2),
      "Incremento (%)": Number((r.incremento_pct ?? 0) * 100).toFixed(2),
      "Parámetros Manuales": r.parametros_manual ? "SÍ" : "NO",
      "Costo Neto Caja (Bs)": Number(r["costo final"] ?? r.costo_neto_caja ?? 0).toFixed(2),
      "Costo Neto Unitario (Bs)": Number(r.costo_neto_unidad ?? 0).toFixed(2),
      "PRECIO CAJA (Bs)": Number(r.precio ?? r["precio final"] ?? r.precio_final_caja ?? 0).toFixed(2),
      "PRECIO FRACCIÓN (Bs)": Number(r.precio_final_unidad ?? 0).toFixed(2),
      Estado: (r.estado || "pendiente").toUpperCase(),
      "Caso Especial": r.caso_especial || "",
      Usuario: r.usuario || "facturador",
    }));

    import("xlsx")
      .then((XLSX) => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws["!cols"] = [
          { wch: 5 },
          { wch: 16 },
          { wch: 35 },
          { wch: 15 },
          { wch: 12 },
          { wch: 15 },
          { wch: 12 },
          { wch: 8 },
          { wch: 12 },
          { wch: 12 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 12 },
          { wch: 14 },
          { wch: 14 },
          { wch: 14 },
          { wch: 14 },
          { wch: 12 },
          { wch: 12 },
          { wch: 10 },
          { wch: 12 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Registro de Márgenes");

        const resumen = [
          { Métrica: "Total de productos procesados", Valor: bitacora.length },
          {
            Métrica: "Productos con parámetros manuales",
            Valor: bitacora.filter((r) => r.parametros_manual).length,
          },
          {
            Métrica: "Productos con casos especiales",
            Valor: bitacora.filter(
              (r) => r.caso_especial && r.caso_especial.toLowerCase() === "si"
            ).length,
          },
          {
            Métrica: "Promedio descuento 1 (%)",
            Valor: (
              bitacora.reduce((sum, r) => sum + ((r.desc1_pct ?? 0) * 100), 0) /
              bitacora.length
            ).toFixed(2),
          },
          {
            Métrica: "Promedio descuento 2 (%)",
            Valor: (
              bitacora.reduce((sum, r) => sum + ((r.desc2_pct ?? 0) * 100), 0) /
              bitacora.length
            ).toFixed(2),
          },
          {
            Métrica: "Promedio incremento (%)",
            Valor: (
              bitacora.reduce((sum, r) => sum + ((r.incremento_pct ?? 0) * 100), 0) /
              bitacora.length
            ).toFixed(2),
          },
        ];
        const wsResumen = XLSX.utils.json_to_sheet(resumen);
        wsResumen["!cols"] = [{ wch: 35 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

        const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `FarmaClinic_Margenes_${new Date()
          .toISOString()
          .slice(0, 10)}_${new Date().toTimeString().slice(0, 5).replace(":", "")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);

        alert(`✅ Excel exportado exitosamente con ${bitacora.length} registros`);
      })
      .catch((err) => {
        console.error("Error al exportar:", err);
        alert("Error al exportar el archivo Excel");
      });
  } catch (error) {
    console.error("Error en exportación:", error);
    alert("Error al preparar la exportación");
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// 💊 MAIN COMPONENT - FARMACLINIC MARGENES
// ───────────────────────────────────────────────────────────────────────────────
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
  const [vistaActiva, setVistaActiva] = useState("margenes");

  // Estados locales para inputs mientras se editan
  const [editingInputs, setEditingInputs] = useState({});
  const [showNetos, setShowNetos] = useState(false);

  // ESTADOS PARA MÓDULO DE REVISIÓN
  const [sesionesPendientes, setSesionesPendientes] = useState([]);
  const [sesionEnRevision, setSesionEnRevision] = useState(null);
  const [productosRevision, setProductosRevision] = useState([]);
  const [preciosSistema, setPreciosSistema] = useState({});
  const [decisiones, setDecisiones] = useState({});

  // Estado de sesión actual
  const [sesionActual, setSesionActual] = useState(null);

  // THEME
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

  // Proveedores y líneas
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
      const matchProv = proveedorFilter === "todos" || p.proveedor === proveedorFilter;
      const matchLinea = lineaFilter === "todas" || p.linea === lineaFilter;
      return matchQ && matchProv && matchLinea;
    });
  }, [data, query, proveedorFilter, lineaFilter]);

  // FILE HANDLING
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

  // ───────────────────────────────────────────────────────────────────────────
  // SESIONES: crear, cargar, finalizar
  // ───────────────────────────────────────────────────────────────────────────
  async function crearNuevaSesion() {
    const nombreSesion = `Factura ${new Date().toLocaleDateString("es-BO")} - ${new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`;
    try {
      const { data: dataIns, error } = await supabase
        .from("sesiones_trabajo")
        .insert([{ nombre: nombreSesion, usuario_creador: "facturador" }])
        .select();

      if (error) {
        console.error("Error creando sesión:", error);
        alert("Error al crear nueva sesión");
        return;
      }
      setSesionActual(dataIns[0]);
      setBitacora([]);
      alert(`Nueva sesión creada: ${nombreSesion}`);
    } catch (err) {
      console.error("Error conectando con Supabase:", err);
      alert("Error de conexión al crear sesión");
    }
  }

  async function cargarHistorialDeSesion(sessionId) {
    try {
      const { data: rows, error } = await supabase
        .from("historial_calculos")
        .select("*")
        .eq("session_id", sessionId)
        .order("fecha_creacion", { ascending: false });

      if (error) {
        console.error("Error cargando historial de sesión:", error);
        return;
      }

      const historialFormateado = (rows || []).map((row) => ({
        ...row,
        fecha: row.fecha_creacion,
        "costo final": row.costo_final_caja,
        precio: row.precio_final_caja,
        "precio final": row.precio_final_caja,
        costo: row.costo_caja,
        costo_caja_ingresado: row.costo_caja,
      }));

      setBitacora(historialFormateado);
    } catch (err) {
      console.error("Error conectando con Supabase:", err);
    }
  }

  // Inicializar: buscar sesión en proceso o crear una
  useEffect(() => {
    async function inicializarSesion() {
      try {
        const { data: rows, error } = await supabase
          .from("sesiones_trabajo")
          .select("*")
          .eq("estado", "en_proceso")
          .eq("usuario_creador", "facturador")
          .order("fecha_inicio", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error buscando sesión:", error);
          return;
        }

        if (rows && rows.length > 0) {
          setSesionActual(rows[0]);
          await cargarHistorialDeSesion(rows[0].id);
        } else {
          await crearNuevaSesion();
        }
      } catch (err) {
        console.error("Error inicializando sesión:", err);
      }
    }
    inicializarSesion();
  }, []);

  async function finalizarSesion() {
    if (!sesionActual || bitacora.length === 0) {
      alert("No hay productos en la sesión actual para finalizar");
      return;
    }

    if (
      !window.confirm(
        `¿Finalizar sesión "${sesionActual.nombre}" con ${bitacora.length} productos y enviarla para revisión?`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("sesiones_trabajo")
        .update({
          estado: "enviada_revision",
          fecha_finalizacion: new Date().toISOString(),
          total_productos: bitacora.length,
        })
        .eq("id", sesionActual.id);

      if (error) {
        console.error("Error finalizando sesión:", error);
        alert("Error al finalizar sesión");
        return;
      }

      alert(`Sesión "${sesionActual.nombre}" finalizada y enviada para revisión`);
      await crearNuevaSesion();
    } catch (err) {
      console.error("Error conectando con Supabase:", err);
      alert("Error de conexión al finalizar sesión");
    }
  }

  async function cargarSesionesPendientes() {
    try {
      const { data: rows, error } = await supabase
        .from("sesiones_trabajo")
        .select("*")
        .eq("estado", "enviada_revision")
        .order("fecha_finalizacion", { ascending: false });

      if (error) throw error;
      setSesionesPendientes(rows || []);
    } catch (err) {
      console.error("Error cargando sesiones pendientes:", err);
    }
  }

  useEffect(() => {
    if (vistaActiva === "revision") {
      cargarSesionesPendientes();
    }
  }, [vistaActiva]);

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRO
  // ───────────────────────────────────────────────────────────────────────────
  function validarYRegistrar(p) {
    if (!sesionActual) {
      alert("No hay sesión activa. Creando nueva sesión...");
      crearNuevaSesion();
      return;
    }

    const entered = costosIngresados[p.id] || {};
    const upc = isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0 ? Number(p.unidades_por_caja) : 1;
    const baseC = isFinite(entered.caja) ? Number(entered.caja) : p.costo_caja ?? 0;

    if (!isFinite(baseC) || baseC <= 0) {
      alert("Ingresa un costo por caja válido para registrar.");
      return;
    }
    registrarEnBitacora(p);
  }

  async function registrarEnBitacora(p) {
    if (!sesionActual) {
      alert("No hay sesión activa");
      return;
    }

    const entered = costosIngresados[p.id] || {};
    const upc = isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0 ? Number(p.unidades_por_caja) : 1;
    const baseC = isFinite(entered.caja) ? Number(entered.caja) : p.costo_caja ?? 0;
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
      session_id: sesionActual.id,
      session_name: sesionActual.nombre,
      producto: p.nombre,
      proveedor: p.proveedor,
      linea: p.linea || "",
      codigo_barras: p.codigo_barras || "",
      cod_ref: p.cod_ref || "",
      unidades_por_caja: upc,
      costo_caja: baseC,
      desc1_pct: d1,
      desc2_pct: d2,
      incremento_pct: inc,
      costo_final_caja: netoC,
      precio_final_caja: finalC,
      precio_final_unitario: finalU,
      parametros_manual: isManual,
      estado: "pendiente_revision",
      usuario: "facturador",
      sector: "facturacion",
    };

    try {
      const { data: inserted, error } = await supabase
        .from("historial_calculos")
        .insert([row])
        .select();

      if (error) {
        console.error("Error guardando en Supabase:", error);
        alert("Error al guardar en la base de datos");
        return;
      }

      const savedRow = {
        ...row,
        id: inserted[0].id,
        fecha: inserted[0].fecha_creacion,
        "costo final": netoC,
        precio: finalC,
        "precio final": finalC,
        fecha_creacion: inserted[0].fecha_creacion,
      };

      setBitacora((prev) => [...prev, savedRow]);

      await supabase
        .from("sesiones_trabajo")
        .update({ total_productos: bitacora.length + 1 })
        .eq("id", sesionActual.id);

      alert("Producto registrado en la sesión actual");
    } catch (err) {
      console.error("Error conectando con Supabase:", err);
      alert("Error de conexión con la base de datos");
    }
  }

  // Drag & Drop
  function handleDragEnd(result) {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) return;

    setBitacora((prev) => {
      const newArray = Array.from(prev);
      const [reorderedItem] = newArray.splice(sourceIndex, 1);
      newArray.splice(destinationIndex, 0, reorderedItem);
      return newArray;
    });
  }

  function eliminarRegistro(index) {
    if (window.confirm("¿Estás seguro de eliminar este registro?")) {
      setBitacora((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function copiarResumen(p) {
    const ov = overrides[p.id] || {};
    const entered = costosIngresados[p.id] || {};
    const upc = isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0 ? Number(p.unidades_por_caja) : 1;

    const baseC = isFinite(entered.caja) ? Number(entered.caja) : p.costo_caja ?? 0;
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

  // ───────────────────────────────────────────────────────────────────────────
  // UI Helpers
  // ───────────────────────────────────────────────────────────────────────────
  const wrapperClass = cn("min-h-screen w-full relative overflow-hidden", isDark ? "text-slate-100" : "text-slate-800");

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

  const priceFinalClass = cn(
    "font-bold tabular-nums text-2xl md:text-3xl tracking-tight drop-shadow-lg",
    isDark
      ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300"
      : "text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600"
  );

  const priceNetClass = cn("font-semibold tabular-nums text-lg md:text-xl tracking-tight", isDark ? "text-amber-300" : "text-amber-600");

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
    border: isDark ? "2px solid rgba(255,255,255,0.15)" : "2px solid rgba(15,23,42,0.25)",
    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)",
    color: isDark ? "#F1F5F9" : "#0f172a",
    WebkitTextFillColor: isDark ? "#F1F5F9" : "#0f172a",
    caretColor: isDark ? "#F1F5F9" : "#0f172a",
    outline: "none",
    transition: "all 0.2s ease",
    boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" : "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
  };

  const costInputStyle = {
    ...hardInput,
    fontSize: "1rem",
    fontWeight: "600",
    height: "2.5rem",
    background: isDark ? "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))" : "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.03))",
    border: isDark ? "2px solid rgba(99,102,241,0.3)" : "2px solid rgba(99,102,241,0.2)",
  };

  // Sidebar (navegación)
  const Sidebar = () => {
    const menuItems = [
      {
        id: "margenes",
        icon: "💊",
        title: "Módulo de Márgenes",
        description: "Cálculo de precios",
        color: isDark ? "from-indigo-500/20 to-purple-500/20 border-indigo-400/30" : "from-indigo-100 to-purple-100 border-indigo-300",
      },
      {
        id: "revision",
        icon: "⚖️",
        title: "Módulo de Revisión",
        description: "Comparación y decisiones",
        color: isDark ? "from-emerald-500/20 to-green-500/20 border-emerald-400/30" : "from-emerald-100 to-green-100 border-emerald-300",
      },
    ];

    return (
      <div
        className={cn(
          "w-80 h-screen fixed left-0 top-0 z-50 p-6 overflow-y-auto",
          isDark ? "bg-slate-900/95 border-r border-white/20" : "bg-white/95 border-r border-slate-200"
        )}
      >
        <div className="mb-8">
          <h2
            className={cn(
              "text-2xl font-bold bg-clip-text text-transparent",
              isDark ? "bg-gradient-to-r from-indigo-300 to-purple-300" : "bg-gradient-to-r from-indigo-600 to-purple-600"
            )}
          >
            FarmaClinic
          </h2>
          <p className={cn("text-sm mt-1", isDark ? "text-slate-400" : "text-slate-600")}>Sistema de Gestión</p>
        </div>

        <nav className="space-y-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setVistaActiva(item.id)}
              className={cn(
                "w-full p-4 rounded-2xl border-2 text-left transition-all duration-300 hover:scale-105",
                vistaActiva === item.id
                  ? `bg-gradient-to-br ${item.color} shadow-lg scale-105`
                  : isDark
                  ? "bg-white/5 border-white/10 hover:bg-white/10"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div
                    className={cn(
                      "font-bold text-base",
                      vistaActiva === item.id ? (isDark ? "text-white" : "text-slate-800") : isDark ? "text-slate-200" : "text-slate-700"
                    )}
                  >
                    {item.title}
                  </div>
                  <div
                    className={cn(
                      "text-sm",
                      vistaActiva === item.id ? (isDark ? "text-slate-300" : "text-slate-600") : isDark ? "text-slate-400" : "text-slate-500"
                    )}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </nav>

        {sesionActual && vistaActiva === "margenes" && (
          <div className={cn("mt-8 p-4 rounded-2xl border-2", isDark ? "bg-blue-500/10 border-blue-400/30" : "bg-blue-50 border-blue-200")}>
            <div className="text-sm font-bold mb-2">Sesión Actual</div>
            <div className={cn("text-sm mb-1", isDark ? "text-slate-300" : "text-slate-600")}>{sesionActual.nombre}</div>
            <div className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{bitacora.length} productos registrados</div>
          </div>
        )}

        <div className="mt-8">
          <Button
            onClick={toggleTheme}
            className={cn(
              "w-full rounded-2xl",
              isDark ? "bg-white/10 border-2 border-white/20 text-white hover:bg-white/20" : "bg-slate-100 border-2 border-slate-300 text-slate-800 hover:bg-slate-200"
            )}
          >
            {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {isDark ? "Modo Claro" : "Modo Oscuro"}
          </Button>
        </div>
      </div>
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className={wrapperClass}>
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
        .price-highlight { animation: pulseGlow 2s ease-in-out infinite; }
        .card-hover:hover { transform: translateY(-2px) scale(1.005); }
      `}</style>

      {bgMain}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="ml-80 min-h-screen">
        {vistaActiva === "margenes" && (
          <div className="relative mx-auto max-w-screen-2xl p-4 md:p-6 space-y-6">
            {/* Header */}
            <header className="group flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1
                  className={cn(
                    "text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent drop-shadow-2xl",
                    isDark ? "bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300" : "bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-cyan-600"
                  )}
                >
                  💊 Módulo de Márgenes
                </h1>
                <p className={cn("mt-2 text-lg font-medium", isDark ? "text-slate-300/90" : "text-slate-600")}>
                  Descuentos de proveedor en cascada + incremento.{" "}
                  <span className={cn("font-bold", isDark ? "text-emerald-300" : "text-emerald-600")}>Sistema de Facturación Profesional</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div style={{ fontSize: 14, opacity: 0.9 }} className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Build: <b>PRO-UX V8.2</b> - d1/d2 COPIA EXACTA de Inc 🔄
                  </div>
                </div>

                {sesionActual && (
                  <div className="mt-3 flex items-center gap-2">
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold",
                        isDark ? "bg-blue-500/20 border border-blue-400/30 text-blue-200" : "bg-blue-100 border border-blue-300 text-blue-700"
                      )}
                    >
                      <Package className="h-4 w-4" />
                      Sesión: {sesionActual.nombre}
                    </div>
                    <div className={cn("px-2 py-1 rounded-lg text-xs font-medium", isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")}>
                      {bitacora.length} productos
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
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
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} className="hidden" />
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
                  onClick={finalizarSesion}
                  disabled={!sesionActual || bitacora.length === 0}
                  className={cn(
                    "rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 px-4 py-3",
                    !sesionActual || bitacora.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : isDark
                      ? "bg-purple-600/80 hover:bg-purple-600 border-2 border-purple-500 backdrop-blur-xl text-white shadow-2xl shadow-purple-900/50"
                      : "bg-purple-600 hover:bg-purple-700 border-2 border-purple-500 text-white shadow-xl shadow-purple-500/30"
                  )}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Finalizar Sesión
                </Button>

                <Button
                  onClick={crearNuevaSesion}
                  className={cn(
                    "rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 px-4 py-3",
                    isDark
                      ? "bg-orange-600/80 hover:bg-orange-600 border-2 border-orange-500 backdrop-blur-xl text-white shadow-2xl shadow-orange-900/50"
                      : "bg-orange-600 hover:bg-orange-700 border-2 border-orange-500 text-white shadow-xl shadow-orange-500/30"
                  )}
                >
                  <Package className="h-5 w-5 mr-2" />
                  Nueva Sesión
                </Button>
              </div>
            </header>

            {/* Filtros */}
            <Card className={cardClass}>
              <CardHeader className="pb-3 sticky top-0 z-10 backdrop-blur-xl">
                <CardTitle className={cn("text-xl font-bold flex items-center gap-2", isDark ? "text-slate-100" : "text-slate-800")}>
                  <Search className="h-5 w-5" />
                  Buscar y filtrar
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:grid md:grid-cols-12 md:items-center">
                <div className="relative md:col-span-6">
                  <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5", isDark ? "text-slate-300" : "text-slate-500")} />
                  <input
                    type="text"
                    placeholder="Buscar por producto, proveedor, marca/línea, código de barras o código ref"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ ...hardInput, textAlign: "left", paddingLeft: "3rem", height: "3rem", fontSize: "1rem" }}
                    autoComplete="off"
                  />
                </div>

                <div className="md:col-span-3">
                  <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
                    <SelectTrigger
                      className={cn(
                        "w-full rounded-2xl h-12 text-base font-medium",
                        isDark ? "bg-white/10 border-2 border-white/20 text-slate-100" : "bg-white/90 border-2 border-slate-300 text-slate-800"
                      )}
                    >
                      <SelectValue placeholder="Proveedor" />
                    </SelectTrigger>
                    <SelectContent className={isDark ? "bg-slate-900/95 border-2 border-white/20 text-slate-100 backdrop-blur-xl" : "bg-white/95 border-2 border-slate-300 text-slate-800 backdrop-blur-xl"}>
                      {proveedores.map((p) => (
                        <SelectItem key={p} value={p} className={cn("focus:bg-white/15 font-medium", !isDark && "focus:bg-slate-100")}>
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
                        isDark ? "bg-white/10 border-2 border-white/20 text-slate-100" : "bg-white/90 border-2 border-slate-300 text-slate-800"
                      )}
                    >
                      <SelectValue placeholder="Marca/Línea" />
                    </SelectTrigger>
                    <SelectContent className={isDark ? "bg-slate-900/95 border-2 border-white/20 text-slate-100 backdrop-blur-xl" : "bg-white/95 border-2 border-slate-300 text-slate-800 backdrop-blur-xl"}>
                      {lineas.map((l) => (
                        <SelectItem key={l} value={l} className={cn("focus:bg-white/15 font-medium", !isDark && "focus:bg-slate-100")}>
                          {l === "todas" ? "Todas las marcas/líneas" : l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

            {/* Productos */}
            <div className="space-y-6">
              {filtrados.map((p) => {
                const entered = costosIngresados[p.id] || {};
                const upc = isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0 ? Number(p.unidades_por_caja) : 1;

                const baseC = isFinite(entered.caja) ? Number(entered.caja) : p.costo_caja ?? 0;
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

                const caso = (p.caso_especial || "").toString().trim().toLowerCase();

                return (
                  <Card key={p.id} className={cn(cardClass, "card-hover")}>
                    <CardContent className="p-5 md:p-6">
                      {/* Cabecera */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0">
                          <div className="font-bold text-lg md:text-xl leading-tight line-clamp-2 mb-2" title={p.nombre}>
                            <Package className="inline h-5 w-5 mr-2" />
                            {p.nombre}
                          </div>
                          <div className={cn("text-sm opacity-90 truncate max-w-full mb-2", isDark ? "text-slate-300" : "text-slate-600")}>
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
                            <span className={cn("text-sm opacity-90 px-2 py-1 rounded-lg", isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")}>🏷️ {p.linea || "-"}</span>
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

                        {/* Chip estado */}
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
                                      : "bg-gradient-to-r from-rose-200 to-red-200 text-rose-800 shadow-rose-300 border-rose-400")
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
                                      : "bg-gradient-to-r from-amber-200 to-yellow-200 text-amber-800 shadow-amber-300 border-amber-400")
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
                                    : "bg-gradient-to-r from-emerald-200 to-green-200 text-emerald-800 shadow-emerald-300 border-emerald-400")
                                }
                              >
                                <CheckCircle2 className="h-4 w-4" /> OK
                              </span>
                            );
                          })(caso)}
                        </div>
                      </div>

                      {/* Grid edición/resultados */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Inputs */}
                        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                          {/* Costo Caja */}
                          <div
                            className={cn(
                              "p-4 rounded-2xl border-2",
                              isDark ? "bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-400/30" : "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300"
                            )}
                          >
                            <div className="text-sm font-bold mb-2 flex items-center gap-2">💰 Costo por Caja</div>
                            <div
                              className="flex rounded-xl overflow-hidden border-2"
                              style={{
                                borderColor: isDark ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.3)",
                              }}
                            >
                              <span
                                className={cn(
                                  "px-3 inline-flex items-center text-sm font-bold",
                                  isDark ? "bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-200" : "bg-gradient-to-r from-indigo-200 to-purple-200 text-indigo-800"
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
                                  costosIngresados[p.id]?.caja === undefined || costosIngresados[p.id]?.caja === null
                                    ? p.costo_caja ?? ""
                                    : String(costosIngresados[p.id]?.caja ?? "")
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === "" || /^[\d\s.,]*$/.test(raw)) {
                                    setCostosIngresados((prev) => ({
                                      ...prev,
                                      [p.id]: { caja: raw === "" ? undefined : raw },
                                    }));
                                  }
                                }}
                                onBlur={(e) => {
                                  const raw = e.target.value;
                                  if (raw !== "") {
                                    const numValue = numBO(raw);
                                    if (numValue !== undefined) {
                                      setCostosIngresados((prev) => ({
                                        ...prev,
                                        [p.id]: { caja: numValue },
                                      }));
                                    }
                                  }
                                }}
                                title="Costo por Caja - Acepta: 123.45, 123,45, 1.234,56"
                                style={costInputStyle}
                              />
                            </div>
                            <div className={cn("text-sm mt-2 opacity-90 tabular-nums font-medium", isDark ? "text-emerald-300" : "text-emerald-600")}>
                              💊 Costo Unitario: Bs {nf.format(baseU)} (x{upc} unidades)
                            </div>
                          </div>

                          {/* d1/d2/inc */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <div className="text-sm font-semibold mb-2">📉 d1 %</div>
                              <input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9.,%]*"
                                autoComplete="off"
                                value={pctDisplay(overrides[p.id]?.d1, p.desc1_pct)}
                                onChange={(e) => {
                                  const dec = parsePercentInput(e.target.value);
                                  setOverrides((prev) => {
                                    const next = { ...(prev[p.id] || {}) };
                                    if (dec === undefined) delete next.d1;
                                    else if (dec !== null) next.d1 = dec;
                                    return { ...prev, [p.id]: next };
                                  });
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
                                  editingInputs[`${p.id}_inc`] !== undefined
                                    ? editingInputs[`${p.id}_inc`]
                                    : overrides[p.id]?.inc !== undefined
                                    ? overrides[p.id].inc * 100
                                    : p.incremento_pct
                                    ? p.incremento_pct * 100
                                    : ""
                                }
                                onFocus={() => {
                                  const currentValue =
                                    overrides[p.id]?.inc !== undefined
                                      ? overrides[p.id].inc * 100
                                      : p.incremento_pct
                                      ? p.incremento_pct * 100
                                      : "";
                                  setEditingInputs((prev) => ({ ...prev, [`${p.id}_inc`]: currentValue }));
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setEditingInputs((prev) => ({ ...prev, [`${p.id}_inc`]: value }));
                                }}
                                onBlur={(e) => {
                                  const value = e.target.value;
                                  if (value === "") {
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
                                          inc: percent / 100,
                                        },
                                      }));
                                    }
                                  }
                                  setEditingInputs((prev) => {
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

                        {/* Resultados Caja */}
                        <div
                          className={cn(
                            "lg:col-span-3 xl:col-span-4 p-4 rounded-2xl border-2",
                            isDark ? "bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-400/30" : "bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-300"
                          )}
                        >
                          <div className="text-sm font-bold mb-3 flex items-center gap-2">📦 Precios por Caja</div>
                          <div className="space-y-3">
                            {showNetos && (
                              <div>
                                <div className="text-sm opacity-90 mb-1">Neto Caja</div>
                                <div className={cn(priceNetClass, "drop-shadow-md")}>Bs {nf.format(netoC)}</div>
                              </div>
                            )}
                            <div>
                              <div className="text-sm opacity-90 mb-1">Costo Final Caja</div>
                              <div className={cn("font-semibold tabular-nums text-lg md:text-xl tracking-tight", isDark ? "text-amber-300" : "text-amber-600")}>
                                Bs {nf.format(netoC)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm opacity-90 mb-1 flex items-center gap-1">
                                <TrendingUp className="h-4 w-4" />
                                Precio Final Caja
                              </div>
                              <div className={cn(priceFinalClass, "price-highlight")}>Bs {nf.format(finalC)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Resultados Unidad */}
                        <div
                          className={cn(
                            "lg:col-span-3 xl:col-span-4 p-4 rounded-2xl border-2",
                            isDark ? "bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-400/30" : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300"
                          )}
                        >
                          <div className="text-sm font-bold mb-3 flex items-center gap-2">💊 Precios Unitarios</div>
                          <div className="space-y-3">
                            {showNetos && (
                              <div>
                                <div className="text-sm opacity-90 mb-1">Neto Unitario</div>
                                <div className={cn(priceNetClass, "drop-shadow-md")}>Bs {nf.format(netoU)}</div>
                              </div>
                            )}
                            <div>
                              <div className="text-sm opacity-90 mb-1">Costo Final Unitario</div>
                              <div className={cn("font-semibold tabular-nums text-lg md:text-xl tracking-tight", isDark ? "text-amber-300" : "text-amber-600")}>
                                Bs {nf.format(netoU)}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm opacity-90 mb-1 flex items-center gap-1">
                                <TrendingUp className="h-4 w-4" />
                                Precio Final Unitario
                              </div>
                              <div className={cn(priceFinalClass, "price-highlight")}>Bs {nf.format(finalU)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Acciones */}
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
                            isDark ? "bg-white/10 border-2 border-white/20 text-slate-100 hover:bg-white/15 shadow-lg" : "bg-white/90 border-2 border-slate-300 text-slate-800 hover:bg-slate-50 shadow-lg"
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
                            isDark ? "bg-amber-500/10 border-2 border-amber-400/30 text-amber-200 hover:bg-amber-500/20 shadow-lg" : "bg-amber-50 border-2 border-amber-300 text-amber-700 hover:bg-amber-100 shadow-lg"
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
                  <CardContent className={cn("text-center py-12", isDark ? "text-slate-300" : "text-slate-600")}>
                    <div className="text-6xl mb-4">🔍</div>
                    <div className="text-xl font-semibold mb-2">Sin resultados</div>
                    <div className="text-base">Ajusta tu búsqueda o carga tu archivo CSV/XLSX</div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Historial */}
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className={cn("text-xl font-bold flex items-center gap-3", isDark ? "text-slate-100" : "text-slate-800")}>
                  📊 Historial de transacciones
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-bold",
                      isDark ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-200" : "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700"
                    )}
                  >
                    {bitacora.length} registros
                  </span>
                  {bitacora.length > 0 && (
                    <span className={cn("text-xs px-2 py-1 rounded-lg", isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")}>🔄 Arrastra para reordenar</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bitacora.length === 0 ? (
                  <div className={cn("text-center py-12", isDark ? "text-slate-300" : "text-slate-600")}>
                    <div className="text-6xl mb-4">📝</div>
                    <div className="text-xl font-semibold mb-2">Historial vacío</div>
                    <div className="text-base">Ingresa costos por caja y valida productos para comenzar a registrar transacciones.</div>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="historial">
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={cn("space-y-4 transition-colors duration-200", snapshot.isDraggingOver && (isDark ? "bg-white/5" : "bg-slate-50"))}
                        >
                          {bitacora.map((r, index) => (
                            <Draggable key={r.id || `item-${index}`} draggableId={String(r.id || `item-${index}`)} index={index}>
                              {(provided2, snapshot2) => (
                                <div
                                  ref={provided2.innerRef}
                                  {...provided2.draggableProps}
                                  className={cn(
                                    "p-4 rounded-2xl border-2 flex flex-col gap-3 transition-all duration-300 relative",
                                    snapshot2.isDragging
                                      ? isDark
                                        ? "bg-gradient-to-br from-white/20 to-white/10 border-white/40 shadow-2xl scale-105 rotate-1"
                                        : "bg-gradient-to-br from-white to-slate-50 border-slate-400 shadow-2xl scale-105 rotate-1"
                                      : isDark
                                      ? "bg-gradient-to-br from-white/10 to-white/5 border-white/20 hover:scale-[1.02] hover:shadow-lg"
                                      : "bg-gradient-to-br from-white to-slate-50/80 border-slate-300 hover:scale-[1.02] hover:shadow-lg"
                                  )}
                                >
                                  <div className="absolute top-3 right-3 flex items-center gap-2">
                                    <div
                                      {...provided2.dragHandleProps}
                                      className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-200",
                                        isDark ? "bg-white/10 hover:bg-white/20 text-slate-300 hover:text-slate-100" : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
                                      )}
                                      title="Arrastra para reordenar"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <circle cx="4" cy="4" r="1.5" />
                                        <circle cx="12" cy="4" r="1.5" />
                                        <circle cx="4" cy="8" r="1.5" />
                                        <circle cx="12" cy="8" r="1.5" />
                                        <circle cx="4" cy="12" r="1.5" />
                                        <circle cx="12" cy="12" r="1.5" />
                                      </svg>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={cn("h-8 w-8 p-0 rounded-lg opacity-70 hover:opacity-100 text-red-500 hover:text-red-400", isDark ? "hover:bg-red-500/10" : "hover:bg-red-50")}
                                      onClick={() => eliminarRegistro(index)}
                                      title="Eliminar registro"
                                    >
                                      🗑️
                                    </Button>
                                  </div>

                                  <div className="flex items-start justify-between gap-4 pr-20">
                                    <div className="min-w-0">
                                      <div className="font-bold text-lg mb-1 flex items-center gap-2">📦 {r.producto}</div>
                                      <div className={cn("text-sm opacity-90 mb-2", isDark ? "text-slate-300" : "text-slate-600")}>
                                        🏢 {r.proveedor || "-"} · 🏷️ {r.linea || "-"} · 📊 EAN: {r.codigo_barras || "-"} · Ref: {r.cod_ref || "-"}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                        <span className={cn("px-2 py-1 rounded-lg font-medium", isDark ? "bg-white/10" : "bg-slate-100")}>
                                          📅 {new Date(r.fecha).toLocaleString()}
                                        </span>
                                        <span
                                          className={cn(
                                            "px-3 py-1 rounded-full font-bold text-sm",
                                            (r.estado || "").toLowerCase() === "validado"
                                              ? isDark
                                                ? "bg-gradient-to-r from-emerald-500/30 to-green-500/30 text-emerald-200 border border-emerald-400/50"
                                                : "bg-gradient-to-r from-emerald-200 to-green-200 text-emerald-800 border-emerald-400"
                                              : isDark
                                              ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-200 border-amber-400/50"
                                              : "bg-gradient-to-r from-amber-200 to-orange-200 text-amber-800 border-amber-400"
                                          )}
                                        >
                                          {(r.estado || "pendiente").toUpperCase() === "VALIDADO" ? "✅ VALIDADO" : "⏳ PENDIENTE"}
                                        </span>
                                        <span className={cn("text-xs px-2 py-1 rounded-lg font-medium", isDark ? "bg-indigo-500/20 text-indigo-200" : "bg-indigo-100 text-indigo-700")}>
                                          #{index + 1}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                      <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-blue-500/20 border border-blue-400/30" : "bg-blue-50 border border-blue-200")}>
                                        <div className="text-xs opacity-80 mb-1">💰 Costo</div>
                                        <div className="font-bold tabular-nums text-lg">Bs {nf.format(r.costo ?? r.costo_caja_ingresado ?? 0)}</div>
                                      </div>

                                      <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-amber-500/20 border border-amber-400/30" : "bg-amber-50 border border-amber-200")}>
                                        <div className="text-xs opacity-80 mb-1">🧮 Costo Final</div>
                                        <div className="font-bold tabular-nums text-lg">Bs {nf.format(r["costo final"] ?? r.costo_neto_caja ?? 0)}</div>
                                      </div>

                                      <div
                                        className={cn(
                                          "px-3 py-2 rounded-xl",
                                          isDark ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/30" : "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                                        )}
                                      >
                                        <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                                          <TrendingUp className="h-3 w-3" />
                                          Precio Final
                                        </div>
                                        <div className="font-bold tabular-nums text-xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600">
                                          Bs {nf.format(r.precio ?? r["precio final"] ?? r.precio_final_caja ?? 0)}
                                        </div>
                                      </div>

                                      <div
                                        className={cn(
                                          "px-3 py-2 rounded-xl",
                                          isDark ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30" : "bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200"
                                        )}
                                      >
                                        <div className="text-xs opacity-80 mb-1 flex items-center gap-1">💊 Precio Unit.</div>
                                        <div className="font-bold tabular-nums text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
                                          Bs {nf.format(r.precio_final_unidad ?? 0)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </CardContent>
            </Card>

            {/* Footer */}
            <footer className={cn("text-center py-8 space-y-2", isDark ? "text-slate-300" : "text-slate-600")}>
              <div className="text-2xl">💊</div>
              <div className="text-sm font-semibold">FarmaClinic · Módulo de Márgenes · {new Date().getFullYear()}</div>
              <div className="text-xs opacity-75">Sistema Profesional de Gestión de Precios Farmacéuticos</div>
            </footer>
          </div>
        )}

        {vistaActiva === "revision" && (
          <div className="relative mx-auto max-w-screen-2xl p-4 md:p-6 space-y-6">
            <header>
              <h1
                className={cn(
                  "text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent drop-shadow-2xl",
                  isDark ? "bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300" : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600"
                )}
              >
                ⚖️ Módulo de Revisión
              </h1>
              <p className={cn("mt-2 text-lg font-medium", isDark ? "text-slate-300/90" : "text-slate-600")}>Comparación de precios y toma de decisiones</p>
            </header>

            <Card className={cardClass}>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">🔄</div>
                <div className="text-xl font-semibold mb-2">Módulo en construcción</div>
                <div className="text-base">Aquí se implementará la comparación de precios</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
