import React, { useMemo, useState, useEffect, useRef } from "react";
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN INICIAL DE SUPABASE Y CONSTANTES DEL SISTEMA
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. UTILIDADES DE FORMATEO Y CONVERSIÓN NUMÉRICA
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

// 2.1. Función para conversión numérica boliviana (soporta 1.234,56 / 1,234.56 / 1234,56)
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

// 2.2. Funciones para manejo de porcentajes en inputs
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 3. DATOS DEMO Y MUESTRAS PARA DESARROLLO
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 4. SISTEMA DE NORMALIZACIÓN DE CABECERAS DE ARCHIVOS CSV/XLSX
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 5. PROCESADORES DE ARCHIVOS - PARSEADORES CSV Y XLSX
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

// 5.1. Procesador específico para archivos CSV con Papa Parse
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

// 5.2. Procesador específico para archivos Excel (XLSX/XLS) con SheetJS
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 6. ALGORITMO DE CÁLCULO DE DESCUENTOS EN CASCADA
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
function aplicarDescuentosProveedor(c, d1 = 0, d2 = 0) {
  const D1 = Math.min(Math.max(Number(d1) || 0, 0), 1);
  const D2 = Math.min(Math.max(Number(d2) || 0, 0), 1);
  return Number(c || 0) * (1 - D1) * (1 - D2);
}
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 7. SISTEMA DE EXPORTACIÓN A EXCEL CON FORMATO Y RESUMEN ESTADÍSTICO
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
function exportBitacora(bitacora = []) {
  try {
    if (!Array.isArray(bitacora) || bitacora.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const excelData = bitacora.map((r, index) => ({
      "N°": index + 1,
      Fecha: new Date(r.fecha || Date.now()).toLocaleString("es-BO", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }),
      Producto: r.producto || "",
      Proveedor: r.proveedor || "",
      "Marca/Línea": r.linea || "",
      "Código de Barras": r.codigo_barras || "",
      "Código Ref": r.cod_ref || "",
      "Unidades por Caja": Number(r.unidades_por_caja ?? 1),
      "Cantidad (Cajas)": Number(r.cantidad_cajas ?? 0),
      "Cantidad (Unidades)": Number(r.cantidad_unidades ?? 0),
      "Lote": r.lote ?? "",
      "Vencimiento": r.fecha_vencimiento ?? "",
      "Costo Caja (Bs)": Number(r.costo ?? r.costo_caja ?? r.costo_caja_ingresado ?? 0).toFixed(2),
      "Costo Unitario (Bs)": Number(
        (r.costo ?? r.costo_caja ?? r.costo_caja_ingresado ?? 0) / (r.unidades_por_caja || 1)
      ).toFixed(2),
      "Descuento 1 (%)": Number((r.desc1_pct ?? 0) * 100).toFixed(2),
      "Descuento 2 (%)": Number((r.desc2_pct ?? 0) * 100).toFixed(2),
      "Incremento (%)": Number((r.incremento_pct ?? 0) * 100).toFixed(2),
      "Parámetros Manuales": r.parametros_manual ? "SÍ" : "NO",
      "Costo Neto Caja (Bs)": Number(r["costo final"] ?? r.costo_neto_caja ?? r.costo_final_caja ?? 0).toFixed(2),
      "Costo Neto Unitario (Bs)": Number(r.costo_neto_unidad ?? 0).toFixed(2),
      "PRECIO CAJA (Bs)": Number(r.precio ?? r["precio final"] ?? r.precio_final_caja ?? 0).toFixed(2),
      "PRECIO FRACCIÓN (Bs)": Number(r.precio_final_unidad ?? 0).toFixed(2),
      Estado: (r.estado || "pendiente_revision").toUpperCase(),
      Usuario: r.usuario || "facturador",
      "Sesión": r.session_id || "",
    }));

    import("xlsx")
      .then((XLSX) => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws["!cols"] = [
          { wch: 5 },  { wch: 16 }, { wch: 35 }, { wch: 15 }, { wch: 16 }, { wch: 15 },
          { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
          { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 38 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Bitacora");

        // Resumen (mantengo tu lógica base)
        const resumen = [
          { Métrica: "Total de registros", Valor: bitacora.length },
          { Métrica: "Promedio descuento 1 (%)", Valor: (
              bitacora.reduce((sum, r) => sum + ((r.desc1_pct ?? 0) * 100), 0) / bitacora.length
            ).toFixed(2)
          },
          { Métrica: "Promedio descuento 2 (%)", Valor: (
              bitacora.reduce((sum, r) => sum + ((r.desc2_pct ?? 0) * 100), 0) / bitacora.length
            ).toFixed(2)
          },
          { Métrica: "Promedio incremento (%)", Valor: (
              bitacora.reduce((sum, r) => sum + ((r.incremento_pct ?? 0) * 100), 0) / bitacora.length
            ).toFixed(2)
          },
        ];
        const wsResumen = XLSX.utils.json_to_sheet(resumen);
        wsResumen["!cols"] = [{ wch: 35 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

        const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bitacora_margenes_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          alert(`✅ Excel exportado exitosamente con ${bitacora.length} registros`);
        }, 100);
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 8. COMPONENTE PRINCIPAL - FARMACLINIC MÁRGENES - INICIO
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
export default function AppMargenes() {
// === Inyectado: funciones de revisión y export dentro del componente (acceso a estados/props) ===
  async function exportarDecisionesExcel() {
    try {
      const sessionId = sesionEnRevision?.id ?? sesionActual?.id;
      if (!sessionId) {
        alert("No hay sesión activa ni en revisión para exportar.");
        return;
      }
      const { data, error } = await supabase
        .from("v_export_pos")
        .select("*")
        .eq("sesion_id", sessionId);
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) {
        alert("No hay decisiones para exportar.");
        return;
      }
      const XLSX = await import("xlsx");
      const excelData = rows.map((r, i) => ({
        "#": i + 1,
        "Sesión": r.sesion_id,
        "Nombre Sesión": r.sesion_nombre || "",
        "Sucursal": r.sesion_sucursal || "",
        "Producto": r.producto || "",
        "Proveedor": r.proveedor || "",
        "Línea": r.linea || "",
        "Código Barras": r.codigo_barras || "",
        "Cod Ref": r.cod_ref || "",
        "Unid/Caja": Number(r.unidades_por_caja ?? 0),
        "Calc Caja (Bs)": Number(r.calculado_caja ?? 0),
        "Calc Unit (Bs)": Number(r.calculado_unitario ?? 0),
        "Cant Cajas": Number(r.cantidad_cajas ?? 0),
        "Cant Unidades": Number(r.cantidad_unidades ?? 0),
        "Lote": r.lote || "",
        "Vencimiento": r.fecha_vencimiento || "",
        "Decisión": r.decision || "",
        "ERP Unit Usado (Bs)": Number(r.erp_unitario_usado ?? 0),
        "Calc Unit Usado (Bs)": Number(r.calc_unitario_usado ?? 0),
        "Final Unit (Bs)": Number(r.final_unitario ?? 0),
        "Final Caja (Bs)": Number(r.final_caja ?? 0),
        "Usuario Revisor": r.usuario_revisor || "",
        "Fecha Decisión": r.fecha_decision || "",
        "Motivo": r.motivo || "",
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      ws["!cols"] = [
        { wch: 4 }, { wch: 38 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 16 },
        { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 28 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Decisiones");
      const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `decisiones_revision_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("exportarDecisionesExcel() error:", e);
      alert("No se pudieron exportar las decisiones.");
    }
  }

  async function cargarDecisionesDeSesion() {
    const sessionId = sesionEnRevision?.id ?? sesionActual?.id;
    if (!sessionId) {
      alert("No hay sesión activa ni sesión en revisión.");
      return;
    }
    try {
      setLoadingDecisiones(true);
      const { data, error } = await supabase
        .from("revision_lineas")
        .select(`
          id,
          historial_id,
          session_id,
          decision,
          precio_final,
          precio_erp_usado,
          precio_calculado_usado,
          motivo,
          usuario_revisor,
          fecha_decision
        `)
        .eq("session_id", sessionId)
        .order("fecha_decision", { ascending: false });
      if (error) throw error;
      setDecisionesHistorial(data || []);
    } catch (e) {
      console.error("Error cargando decisiones:", e);
      alert("No se pudieron cargar las decisiones.");
    } finally {
      setLoadingDecisiones(false);
    }
  }

  async function guardarDecisionLinea(historialId, decisionRow) {
    try {
      const sessionId = sesionEnRevision?.id ?? sesionActual?.id;
      if (!sessionId) {
        alert("No hay sesión activa ni en revisión.");
        return;
      }
      let row = decisionRow;
      if (!row && typeof decisiones === "object") {
        row = decisiones[historialId];
      }
      if (!historialId || !row) {
        alert("Faltan datos de la decisión.");
        return;
      }
      const payload = {
        session_id: sessionId,
        historial_id: historialId,
        decision: row.decision ?? row.accion_tomada ?? null,
        precio_final: row.precio_final ?? row.precio_final_aprobado ?? null,
        precio_erp_usado: row.precio_erp_usado ?? row.erp_unitario_usado ?? null,
        precio_calculado_usado: row.precio_calculado_usado ?? row.calc_unitario_usado ?? null,
        motivo: row.motivo ?? row.observaciones ?? null,
        usuario_revisor: row.usuario_revisor ?? 'revisor' ?? "revisor",
        fecha_decision: new Date().toISOString(),
      };
      const { error } = await supabase
      .from("revision_lineas")
        .upsert(payload, { onConflict: "session_id,historial_id" });
      if (error) throw error;
      alert("Decisión guardada.");
      if (typeof cargarDecisionesDeSesion === "function") {
        await cargarDecisionesDeSesion();
      }
    } catch (e) {
      console.error("guardarDecisionLinea() error:", e);
      alert("No se pudo guardar la decisión.");
    }
  }

  async function guardarTodasLasDecisiones() {
    try {
      const sessionId = sesionEnRevision?.id;
      if (!sessionId) {
        alert("No hay sesión en revisión.");
        return;
      }

      // Verificar que hay decisiones tomadas
      const decisionesTomadas = productosRevision.filter(r => decisiones[`decision_${r.id}`]);
      if (decisionesTomadas.length === 0) {
        alert("Toma al menos una decisión antes de guardar.");
        return;
      }

      // Preparar decisiones SOLO para productos que tienen decisión tomada
      const rows = decisionesTomadas.map(r => {
        const code = r.codigo_barras || r.cod_ref;
        const ps = preciosSistema[code];
        const precioNuevo = r.precio_final_unitario ?? 0;
        const precioAnteriorSistema = ps?.precio_caja ? (ps.precio_caja / (r.unidades_por_caja || 1)) : null;
        const precioAnteriorEditado = decisiones[`precio_anterior_${r.id}`] ? Number(decisiones[`precio_anterior_${r.id}`]) : null;
        const precioAnterior = precioAnteriorEditado || precioAnteriorSistema;
        
        const decision = decisiones[`decision_${r.id}`] || 'usar_nuevo';
        let precioFinal = precioNuevo;
        let accionParaBD = 'usar_nuevo'; // valor por defecto
        
        // Usar solo valores que sabemos que funcionan
        accionParaBD = 'nuevo'; // valor por defecto que siempre funciona
        
        if (decision === 'usar_anterior' && precioAnterior) {
          precioFinal = precioAnterior;
          // Mantener 'nuevo' pero con precio anterior
        } else if (decision === 'promediar' && precioAnterior) {
          precioFinal = (precioNuevo + precioAnterior) / 2;
          // Mantener 'nuevo' pero con precio promedio
        } else if (decision === 'reprocesar') {
          precioFinal = precioNuevo;
          // Mantener 'nuevo' para reprocesar
        } else {
          precioFinal = precioNuevo;
        }

        return {
          session_id: sessionId,
          historial_id: r.id,
          codigo_barras: r.codigo_barras,
          cod_ref: r.cod_ref,
          accion_tomada: accionParaBD,
          precio_sistema_unitario: precioAnterior,
          precio_calculado_unitario: precioNuevo,
          precio_final_aprobado: precioFinal,
          observaciones: decisiones[`observacion_${r.id}`] || decisiones.observaciones_global || null,
          usuario_revisor: "revisor",
          fecha_decision: new Date().toISOString(),
          sucursal: "Principal"
        };
      });

      // Guardar en la tabla decisiones_comparacion
      const { error } = await supabase
        .from("decisiones_comparacion")
        .insert(rows);
      
      if (error) throw error;

      // Actualizar precios_sistema con los precios finales aprobados (excepto reprocesar)
      const preciosParaActualizar = rows
        .filter(r => (r.codigo_barras || r.cod_ref) && r.accion_tomada !== 'reprocesar')
        .map(r => {
          const producto = productosRevision.find(p => p.id === r.historial_id);
          return {
            codigo_barras: r.codigo_barras,
            cod_ref: r.cod_ref,
            precio_caja: r.precio_final_aprobado * (producto?.unidades_por_caja || 1),
            updated_at: new Date().toISOString()
          };
        });

      if (preciosParaActualizar.length > 0) {
        const { error: errorPrecios } = await supabase
          .from("precios_sistema")
          .upsert(preciosParaActualizar);
        
        if (errorPrecios) console.error("Error actualizando precios_sistema:", errorPrecios);
      }

      // Contar tipos de decisiones
      const conteos = rows.reduce((acc, r) => {
        acc[r.accion_tomada] = (acc[r.accion_tomada] || 0) + 1;
        return acc;
      }, {});

      const resumen = Object.entries(conteos).map(([tipo, cantidad]) => {
        const nombres = {
          'usar_anterior': 'Usar Anterior',
          'usar_nuevo': 'Usar Nuevo',
          'promediar': 'Promediar',
          'reprocesar': 'Reprocesar'
        };
        return `${nombres[tipo]}: ${cantidad}`;
      }).join(', ');

      alert(`Decisiones guardadas para ${rows.length} de ${productosRevision.length} productos.\n${resumen}\nPrecios actualizados en el sistema.`);
      
      // Limpiar decisiones y recargar
      setDecisiones({});
      await cargarDecisionesDeSesion();
      
    } catch (e) {
      console.error("guardarTodasLasDecisiones() error:", e);
      alert("No se pudieron guardar las decisiones.");
    }
  }

  async function cargarSesionesPendientes() {
  try {
    const estadosPendientes = ['enviada_revision', 'finalizada'];
    const { data, error } = await supabase
      .from('sesiones_trabajo')
      .select('*')
      .in('estado', estadosPendientes)
      .order('fecha_inicio', { ascending: false });
    if (error) throw error;
    setSesionesPendientes(data || []);
  } catch (e) {
    console.error('Error cargando sesiones pendientes:', e);
    alert('No se pudieron cargar las sesiones pendientes.');
  }
}

  // 8.1. ESTADOS PRINCIPALES DEL SISTEMA
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  const [data, setData] = useState(DEMO);
  const [query, setQuery] = useState("");
  const [proveedorFilter, setProveedorFilter] = useState("todos");
  const [lineaFilter, setLineaFilter] = useState("todas");
  const [bitacora, setBitacora] = useState([]);
  const [costosIngresados, setCostosIngresados] = useState({});
  const [theme, setTheme] = useState("dark");
  const [overrides, setOverrides] = useState({});
  const [vistaActiva, setVistaActiva] = useState("margenes");

  // 8.2. ESTADOS LOCALES PARA EDICIÓN DE INPUTS EN TIEMPO REAL
  const [editingInputs, setEditingInputs] = useState({});
  const [showNetos, setShowNetos] = useState(false);

  // 8.3. ESTADOS ESPECÍFICOS PARA EL MÓDULO DE REVISIÓN
  const [sesionesPendientes, setSesionesPendientes] = useState([]);
  const [sesionEnRevision, setSesionEnRevision] = useState(null);
  const [productosRevision, setProductosRevision] = useState([]);
  const [preciosSistema, setPreciosSistema] = useState({});
  const [decisiones, setDecisiones] = useState({});
  
  // 8.5. ESTADOS PARA HISTORIAL (DECISIONES DESDE SUPABASE)
  const [decisionesHistorial, setDecisionesHistorial] = useState([]);
  const [loadingDecisiones, setLoadingDecisiones] = useState(false);

  // 8.4. Estado de la sesión de trabajo actual
  const [sesionActual, setSesionActual] = useState(null);

  // Estados para feedback visual de registro
  const [registrosProcesados, setRegistrosProcesados] = useState(new Set());
  const [procesandoRegistro, setProcesandoRegistro] = useState(new Set());

  // 15.2. Estados para eliminación con undo
  const undoTimerRef = useRef(null);
  const [undo, setUndo] = useState(null);
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 9. SISTEMA DE GESTIÓN DE TEMA VISUAL (DARK/LIGHT MODE)
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 10. GENERACIÓN AUTOMÁTICA DE LISTAS ÚNICAS PARA FILTROS
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

  // 10.1. SISTEMA DE FILTRADO COMBINADO (TEXTO, PROVEEDOR, LÍNEA)
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

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 11. MANEJADOR DE CARGA DE ARCHIVOS CSV/XLSX
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 12. GESTIÓN DE SESIONES DE TRABAJO - CREAR, CARGAR, FINALIZAR
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

  // 12.1. Creación de nueva sesión de trabajo
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

  // 12.2. Cargador de historial de sesiones específicas
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

  // 12.3. Inicializador automático de sesiones al cargar la aplicación
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

  // 12.4. Finalizador de sesiones y envío a revisión
async function finalizarSesion() {
  try {
    if (!sesionActual?.id) {
      alert("No hay sesión activa para finalizar.");
      return;
    }

    // Contar registros reales en DB (no usar bitacora.length)
    const { count, error: errCount } = await supabase
      .from("historial_calculos")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sesionActual.id);

    if (errCount) {
      console.error("Error contando productos de la sesión:", errCount);
      alert("No se pudo finalizar: error contando productos");
      return;
    }

    // Actualizar sesión a finalizada / enviada a revisión
    const { error: errUpd } = await supabase
      .from("sesiones_trabajo")
      .update({
        estado: "enviada_revision",
        total_productos: count ?? 0,
        fecha_finalizacion: new Date().toISOString(),
      })
      .eq("id", sesionActual.id);

    if (errUpd) {
      console.error("Error finalizando sesión:", errUpd);
      alert("Error al finalizar sesión");
      return;
    }

    alert(`Sesión "${sesionActual.nombre}" finalizada con ${count ?? 0} productos. Lista para revisión.`);
    await crearNuevaSesion?.();
  } catch (e) {
    console.error("finalizarSesion() exception:", e);
    alert("Ocurrió un error al finalizar la sesión.");
  }
}
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 13. FUNCIONES AUXILIARES PARA EL MÓDULO DE REVISIÓN
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

  // 13.1. Apertura de sesión específica para proceso de revisión
  async function abrirSesionParaRevision(sesion) {
    try {
      setSesionEnRevision(sesion);
      
      // 1) Cargar líneas de la sesión
      const { data: filas, error } = await supabase
        .from('historial_calculos')
        .select('*')
        .eq('session_id', sesion.id)
        .order('fecha_creacion', { ascending: true });
      if (error) throw error;
      setProductosRevision(filas || []);

      // 2) Cargar todos los precios del sistema para comparación
      const { data: ps, error: e2 } = await supabase
        .from('precios_sistema')
        .select('*');
      
      if (!e2 && ps) {
        const byCode = {};
        for (const row of ps) {
          if (row.codigo_barras) byCode[row.codigo_barras] = row;
          if (row.cod_ref) byCode[row.cod_ref] = row;
        }
        setPreciosSistema(byCode);
      } else {
        setPreciosSistema({});
      }
      
      // 3) Limpiar decisiones previas
      setDecisiones({});
      
    } catch (err) {
      console.error('Error abriendo sesión en revisión:', err);
      alert('No se pudo cargar la sesión para revisión.');
    }
  }
  // 13.2. Calculadora de diferencias porcentuales para comparación de precios
  function diffPct(a, b) {
    const A = Number(a), B = Number(b);
    if (!isFinite(A) || !isFinite(B) || B === 0) return null;
    return ((A - B) / B) * 100;
  }

  // 13.3. Setter de decisiones individuales por línea de producto
  function setDecision(lineaId, payload) {
    setDecisiones(prev => ({
      ...prev,
      [lineaId]: { ...(prev[lineaId] || {}), ...payload }
    }));
  }

  // 13.4. Finalizador del proceso de revisión completo
  async function finalizarRevisionActual() {
    if (!sesionEnRevision) return;
    try {
      const { error } = await supabase
        .from('sesiones_trabajo')
        .update({ estado: 'completada' })
        .eq('id', sesionEnRevision.id);
      if (error) throw error;
      alert('Sesión marcada como completada.');
      setSesionEnRevision(null);
      setProductosRevision([]);
      setDecisiones({});
      cargarSesionesPendientes();
    } catch (e) {
      console.error(e);
      alert('No se pudo finalizar la revisión.');
    }
  }

  // 13.5. Hook para cargar sesiones pendientes automáticamente
  useEffect(() => {
    if (vistaActiva === "revision") {
      cargarSesionesPendientes();
    }
  }, [vistaActiva]);
  

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 14. SISTEMA DE REGISTRO Y VALIDACIÓN EN BITÁCORA
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

  // 14.1. Validador previo antes de registrar en bitácora
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

  // 14.2. Registrador principal en bitácora con persistencia en Supabase y feedback visual
  async function registrarEnBitacora(p) {
  try {
    if (!sesionActual?.id) {
      alert("No hay sesión activa. Crea una sesión antes de registrar.");
      return;
    }

    // Indicar que se está procesando
    setProcesandoRegistro(prev => new Set([...prev, p.id]));

    // ---- 1) Obtener datos calculados actuales ----
    const entered = costosIngresados[p.id] || {};
    const ov = overrides[p.id] || {};
    const upc = Number.isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0 ? Number(p.unidades_por_caja) : 1;

    // Costo base
    const baseC = isFinite(entered.caja) ? Number(entered.caja) : p.costo_caja ?? 0;
    const baseU = upc > 0 ? baseC / upc : baseC;

    // Descuentos e incremento (con overrides)
    const d1 = ov.d1 ?? p.desc1_pct ?? 0;
    const d2 = ov.d2 ?? p.desc2_pct ?? 0;
    const inc = ov.inc ?? p.incremento_pct ?? 0;

    // Cálculos finales
    const netoC = aplicarDescuentosProveedor(baseC, d1, d2);
    const netoU = aplicarDescuentosProveedor(baseU, d1, d2);
    const finalC = netoC * (1 + inc);
    const finalU = netoU * (1 + inc);

    // ---- 2) Validaciones ----
    if (baseC <= 0) {
      setProcesandoRegistro(prev => { const next = new Set(prev); next.delete(p.id); return next; });
      alert("Ingresa un costo por caja válido para registrar.");
      return;
    }

    if (entered.cantidad_cajas !== undefined && entered.cantidad_cajas !== "" && Number(entered.cantidad_cajas) < 0) {
      setProcesandoRegistro(prev => { const next = new Set(prev); next.delete(p.id); return next; });
      alert("La cantidad de cajas no puede ser negativa.");
      return;
    }

    // ---- 3) Preparar datos para inserción ----
    const nombreProducto = (p?.producto ?? p?.descripcion ?? p?.nombre ?? "").toString().trim() || "SIN_NOMBRE";
    
    const cajas = (entered.cantidad_cajas === "" || entered.cantidad_cajas === undefined) ? 0 : Number(entered.cantidad_cajas) || 0;
    const cantidadUnidades = cajas * upc;
    
    const loteVal = (entered.lote ?? "").toString().trim() || null;
    const fechaVtoVal = (entered.fecha_vencimiento ?? "").toString().trim() || null;

    const row = {
      session_id: sesionActual.id,
      producto: nombreProducto,
      proveedor: (p.proveedor ?? "").toString().trim() || null,
      linea: (p.linea ?? "").toString().trim() || null,
      codigo_barras: p.codigo_barras || null,
      cod_ref: p.cod_ref || null,
      unidades_por_caja: upc,
      costo_caja: baseC,
      desc1_pct: d1,
      desc2_pct: d2,
      incremento_pct: inc,
      costo_final_caja: netoC,
      precio_final_caja: finalC,
      precio_final_unitario: finalU,
      cantidad_cajas: cajas,
      cantidad_unidades: cantidadUnidades,
      lote: loteVal,
      fecha_vencimiento: fechaVtoVal,
      parametros_manual: ov.d1 != null || ov.d2 != null || ov.inc != null,
      estado: "pendiente_revision",
    };

    // ---- 4) Insert en Supabase ----
    const { error: errIns } = await supabase.from("historial_calculos").insert(row);

    if (errIns) {
      console.error("Error insertando en historial_calculos:", errIns);
      setProcesandoRegistro(prev => { const next = new Set(prev); next.delete(p.id); return next; });
      alert("No se pudo registrar en el historial.");
      return;
    }

    // ---- 5) Actualizar estado local con datos correctos ----
    const bitacoraItem = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      fecha: new Date().toISOString(),
      producto: nombreProducto,
      proveedor: row.proveedor,
      linea: row.linea,
      codigo_barras: row.codigo_barras,
      cod_ref: row.cod_ref,
      costo: baseC,
      costo_caja_ingresado: baseC,
      "costo final": netoC,
      costo_final_caja: netoC,
      precio: finalC,
      "precio final": finalC,
      precio_final_caja: finalC,
      precio_final_unitario: finalU,
      cantidad_cajas: cajas,
      cantidad_unidades: cantidadUnidades,
      lote: loteVal,
      fecha_vencimiento: fechaVtoVal,
      unidades_por_caja: upc,
    };

    setBitacora((prev) => [...prev, bitacoraItem]);
    
    // ---- 6) Limpiar inputs ----
    setCostosIngresados((prev) => ({
      ...prev,
      [p.id]: { ...(prev[p.id] || {}), cantidad_cajas: "", lote: "", fecha_vencimiento: "" },
    }));

    // ---- 7) Feedback visual ----
    setProcesandoRegistro(prev => { const next = new Set(prev); next.delete(p.id); return next; });
    setRegistrosProcesados(prev => new Set([...prev, p.id]));
    
    setTimeout(() => {
      setRegistrosProcesados(prev => { const next = new Set(prev); next.delete(p.id); return next; });
    }, 3000);

  } catch (e) {
    console.error("registrarEnBitacora() exception:", e);
    setProcesandoRegistro(prev => { const next = new Set(prev); next.delete(p.id); return next; });
    alert("Ocurrió un error inesperado al registrar.");
  }
}

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 15. SISTEMA DE DRAG & DROP Y MANIPULACIÓN DE HISTORIAL
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

  // 15.1. Manejador para reordenamiento por drag & drop
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

  // 15.2. Funciones para eliminación con sistema undo
  function cancelarUndo() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndo(null);
  }

  async function commitDeleteToSupabase(rowId) {
    if (!rowId) return;
    const { error } = await supabase
      .from("historial_calculos")
      .delete()
      .eq("id", rowId);
    if (error) throw error;
  }

  async function actualizarContadorSesionDespuesDeEliminar(prevLen = 0) {
    if (!sesionActual) return;
    try {
      await supabase
        .from("sesiones_trabajo")
        .update({
          total_productos: Math.max((sesionActual.total_productos ?? prevLen) - 1, 0),
        })
        .eq("id", sesionActual.id);
    } catch {
      // best-effort
    }
  }

  function eliminarRegistro(index, record) {
    if (!window.confirm("¿Estás seguro de eliminar este registro?")) return;

    // Limpia cualquier undo previo
    cancelarUndo();

    // 1) Optimistic UI: remover de bitácora y guardar estado para deshacer
    const prev = bitacora;
    const removed = prev[index];
    const next = prev.filter((_, i) => i !== index);
    setBitacora(next);
    setUndo({ index, record: removed, committed: false });

    // 2) Programa commit en 5s (si no hay deshacer)
    undoTimerRef.current = setTimeout(async () => {
      undoTimerRef.current = null;
      try {
        await commitDeleteToSupabase(removed?.id);
        await actualizarContadorSesionDespuesDeEliminar(prev.length);
        setUndo((u) => (u ? { ...u, committed: true } : null));
        // Borra la barra al completar
        setTimeout(() => setUndo(null), 500);
      } catch (e) {
        console.error("No se pudo eliminar en Supabase:", e);
        alert("⚠ No se pudo eliminar en la base de datos. Se revierte el cambio local.");
        // rollback
        setBitacora(prev);
        setUndo(null);
      }
    }, 5000);
  }

  // 15.3. Copiador de resumen de producto al portapapeles
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
      `Neto Caja: Bs ${nf.format(netoC)} |
      Neto U: Bs ${nf.format(netoU)}`,
      `Final Caja: Bs ${nf.format(finalC)} | Final U: Bs ${nf.format(finalU)}`,
    ].join("\n");
    navigator.clipboard.writeText(texto);
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 16. DEFINICIÓN DE CLASES CSS Y ESTILOS DINÁMICOS
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

  // 16.1. Clase principal del wrapper con gradientes dinámicos
  const wrapperClass = cn("min-h-screen w-full relative overflow-hidden", isDark ? "text-slate-100" : "text-slate-800");

  // 16.2. Fondo principal con gradientes animados según el tema
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

  // 16.3. Estilos para tarjetas principales con efectos glassmorphism
  const cardClass = cn(
    "rounded-3xl backdrop-blur-xl border-2 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl",
    isDark
      ? "shadow-2xl shadow-indigo-950/40 border-white/20 bg-gradient-to-br from-white/15 to-white/5"
      : "shadow-xl shadow-slate-400/20 border-slate-300/50 bg-gradient-to-br from-white/90 to-slate-50/80"
  );

  // 16.4. Estilos para precios finales con gradientes llamativos
  const priceFinalClass = cn(
    "font-bold tabular-nums text-2xl md:text-3xl tracking-tight drop-shadow-lg",
    isDark
      ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300"
      : "text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600"
  );

  // 16.5. Estilos para precios netos intermedios
  const priceNetClass = cn("font-semibold tabular-nums text-lg md:text-xl tracking-tight", isDark ? "text-amber-300" : "text-amber-600");

  // 16.6. Configuración base para inputs con estilos nativos
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

  // 16.7. Estilos específicos para inputs de costo con gradientes
  const costInputStyle = {
    ...hardInput,
    fontSize: "1rem",
    fontWeight: "600",
    height: "2.5rem",
    background: isDark ? "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))" : "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.03))",
    border: isDark ? "2px solid rgba(99,102,241,0.3)" : "2px solid rgba(99,102,241,0.2)",
  };

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 17. COMPONENTE DE BARRA LATERAL DE NAVEGACIÓN
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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
      {
        id: "historial",
        icon: "🗂️",
        title: "Historial de Decisiones",
        description: "Búsqueda y exportación",
        color: isDark ? "from-cyan-500/20 to-blue-500/20 border-cyan-400/30" : "from-cyan-100 to-blue-100 border-cyan-300",
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

        {/* Resumen de sesión visible en módulos donde aplica */}
        {sesionActual && (vistaActiva === "margenes" || vistaActiva === "revision") && (
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 18. RENDER PRINCIPAL DEL COMPONENTE
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
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

      {/* 18.1. Barra lateral de navegación */}
      <Sidebar />

      {/* 18.2. Contenido principal con margen por sidebar */}
      <div className="ml-80 min-h-screen">
        {vistaActiva === "margenes" && (
          <div className="relative mx-auto max-w-screen-2xl p-4 md:p-6 space-y-6">
            {/* ENCABEZADO PRINCIPAL */}
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
                    Build: <b>PRO-UX V8.2</b> - d1/d2 COPIA EXACTA de Inc 🔥
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

              {/* Botones de acción principales del header */}
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

            {/* SECCIÓN DE FILTROS Y BÚSQUEDA */}
            <Card className={cardClass}>
              <CardHeader className="pb-3 sticky top-0 z-10 backdrop-blur-xl">
                <CardTitle className={cn("text-xl font-bold flex items-center gap-2", isDark ? "text-slate-100" : "text-slate-800")}>
                  <Search className="h-5 w-5" />
                  Buscar y filtrar
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:grid md:grid-cols-12 md:items-center">
                {/* Input de búsqueda por texto libre */}
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

                {/* Selector de filtro por proveedor */}
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

                {/* Selector de filtro por línea/marca */}
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

                {/* Controles adicionales de vista */}
                <div className="md:col-span-12 flex flex-wrap gap-3 pt-2">
                  <div className={cn("text-xs px-3 py-2 rounded-xl", isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700")}>
                    ✨ Los costos finales se muestran automáticamente
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Layout principal de dos columnas */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Columna izquierda: Productos */}
              <div className="xl:col-span-8 space-y-6">
              {filtrados.map((p) => {
                // Cálculo de valores base y procesamiento de overrides
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

                // Aplicación del algoritmo de descuentos en cascada
                const netoC = aplicarDescuentosProveedor(baseC, d1, d2);
                const finalC = netoC * (1 + inc);
                const netoU = aplicarDescuentosProveedor(baseU, d1, d2);
                const finalU = netoU * (1 + inc);

                const caso = (p.caso_especial || "").toString().trim().toLowerCase();

                return (
                  <Card key={p.id} className={cn(cardClass, "card-hover")}>
                    <CardContent className="p-5 md:p-6">
                      {/* Cabecera de la tarjeta con información del producto */}
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

                        {/* Chip indicador de estado del producto */}
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

                      {/* Layout compacto de inputs y resultados */}
                      <div className="space-y-4">
                        {/* Panel compacto de inputs */}
                        <div className={cn(
                          "p-4 rounded-2xl border-2",
                          isDark ? "bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-400/30" : "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300"
                        )}>
                          {/* Fila 1: Costo principal */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-bold mb-2">💰 Costo por Caja</div>
                              <div className="flex rounded-xl overflow-hidden border-2" style={{
                                borderColor: isDark ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.3)",
                              }}>
                                <span className={cn(
                                  "px-3 inline-flex items-center text-sm font-bold",
                                  isDark ? "bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-200" : "bg-gradient-to-r from-indigo-200 to-purple-200 text-indigo-800"
                                )}>
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
                              <div className={cn("text-xs mt-1 opacity-90 tabular-nums", isDark ? "text-emerald-300" : "text-emerald-600")}>
                                💊 Unit: Bs {nf.format(baseU)} (x{upc})
                              </div>
                            </div>

                            {/* Logística compacta en la misma fila */}
                            <div>
                              <div className="text-sm font-bold mb-2">📦 Logística</div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="Cajas"
                                    className={cn(
                                      "w-full h-9 px-2 rounded-lg border text-xs",
                                      isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300"
                                    )}
                                    value={costosIngresados[p.id]?.cantidad_cajas ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0);
                                      setCostosIngresados((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || {}), cantidad_cajas: val }
                                      }));
                                    }}
                                  />
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    placeholder="Lote"
                                    className={cn(
                                      "w-full h-9 px-2 rounded-lg border text-xs uppercase",
                                      isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300"
                                    )}
                                    value={costosIngresados[p.id]?.lote ?? ""}
                                    onChange={(e) => {
                                      setCostosIngresados((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || {}), lote: e.target.value.trim().toUpperCase() }
                                      }));
                                    }}
                                  />
                                </div>
                                <div>
                                  <input
                                    type="date"
                                    className={cn(
                                      "w-full h-9 px-2 rounded-lg border text-xs",
                                      isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300"
                                    )}
                                    min={new Date().toISOString().slice(0,10)}
                                    value={costosIngresados[p.id]?.fecha_vencimiento ?? ""}
                                    onChange={(e) => {
                                      setCostosIngresados((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || {}), fecha_vencimiento: e.target.value || "" }
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Fila 2: Descuentos e incremento compactos */}
                          <div className="grid grid-cols-4 gap-3 mt-4">
                            <div>
                              <div className="text-xs font-semibold mb-1">📉 d1 %</div>
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
                                className={cn(
                                  "w-full h-8 px-2 rounded-lg border text-xs text-right",
                                  isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300"
                                )}
                              />
                            </div>

                            <div>
                              <div className="text-xs font-semibold mb-1">📉 d2 %</div>
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
                                className={cn(
                                  "w-full h-8 px-2 rounded-lg border text-xs text-right",
                                  isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300"
                                )}
                              />
                            </div>

                            <div>
                              <div className="text-xs font-semibold mb-1">📈 Inc. %</div>
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
                                title="Incremento en porcentaje"
                                className={cn(
                                  "w-full h-8 px-2 rounded-lg border text-xs text-right",
                                  isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300"
                                )}
                              />
                            </div>

                            {/* Botón de restaurar integrado */}
                            <div className="flex items-end">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isManual}
                                onClick={() => {
                                  setOverrides((prev) => {
                                    const n = { ...prev };
                                    delete n[p.id];
                                    return n;
                                  });
                                }}
                                className={cn(
                                  "h-8 px-3 rounded-lg text-xs",
                                  isDark ? "bg-amber-500/10 border-amber-400/30 text-amber-200" : "bg-amber-50 border-amber-300 text-amber-700"
                                )}
                              >
                                🔄
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Resultados compactos en tres columnas - con costo final */}
                        <div className="grid grid-cols-3 gap-3">
                          {/* Costo Final */}
                          <div className={cn(
                            "p-3 rounded-xl border-2 text-center",
                            isDark ? "bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-400/30" : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300"
                          )}>
                            <div className="text-xs font-bold mb-1">💰 Costo Final</div>
                            <div className={cn("text-xs opacity-80", isDark ? "text-amber-300" : "text-amber-600")}>
                              Caja: Bs {nf.format(netoC)}
                            </div>
                            <div className={cn("font-bold text-sm tracking-tight", isDark ? "text-amber-300" : "text-amber-600")}>
                              Unit: Bs {nf.format(netoU)}
                            </div>
                          </div>

                          {/* Precio Caja */}
                          <div className={cn(
                            "p-3 rounded-xl border-2 text-center",
                            isDark ? "bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-400/30" : "bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-300"
                          )}>
                            <div className="text-xs font-bold mb-1">📦 Precio Caja</div>
                            <div className={cn("font-bold text-lg tracking-tight", isDark ? "text-emerald-300" : "text-emerald-600")}>
                              Bs {nf.format(finalC)}
                            </div>
                          </div>

                          {/* Precio Unitario */}
                          <div className={cn(
                            "p-3 rounded-xl border-2 text-center",
                            isDark ? "bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-400/30" : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300"
                          )}>
                            <div className="text-xs font-bold mb-1">💊 Precio Unit.</div>
                            <div className={cn("font-bold text-lg tracking-tight", isDark ? "text-blue-300" : "text-blue-600")}>
                              Bs {nf.format(finalU)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Panel de acciones con feedback visual */}
                      <div className="mt-4 flex items-center justify-between gap-3">
                        {/* Indicador de estado visual */}
                        <div className="flex-1">
                          {registrosProcesados.has(p.id) && (
                            <div className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-xl animate-pulse",
                              isDark ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-200" : "bg-emerald-100 border border-emerald-300 text-emerald-700"
                            )}>
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="font-semibold">Registrado exitosamente</span>
                            </div>
                          )}
                          {procesandoRegistro.has(p.id) && (
                            <div className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-xl",
                              isDark ? "bg-blue-500/20 border border-blue-400/40 text-blue-200" : "bg-blue-100 border border-blue-300 text-blue-700"
                            )}>
                              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              <span className="font-semibold">Procesando...</span>
                            </div>
                          )}
                        </div>

                        {/* Botones de acción */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="lg"
                            disabled={procesandoRegistro.has(p.id)}
                            className={cn(
                              "rounded-xl text-white px-4 py-2 font-bold transition-all duration-300 hover:scale-105",
                              procesandoRegistro.has(p.id) 
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-500 hover:via-green-500 hover:to-teal-500 shadow-xl"
                            )}
                            onClick={() => validarYRegistrar(p)}
                          >
                            {procesandoRegistro.has(p.id) ? (
                              <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Procesando...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Validar y Registrar
                              </>
                            )}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              "rounded-xl px-3 py-2 font-semibold transition-all duration-300 hover:scale-105",
                              isDark ? "bg-white/10 border-2 border-white/20 text-slate-100 hover:bg-white/15" : "bg-white/90 border-2 border-slate-300 text-slate-800 hover:bg-slate-50"
                            )}
                            onClick={() => copiarResumen(p)}
                          >
                            <ClipboardCopy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Mensaje de estado cuando no hay resultados */}
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

            {/* Columna derecha: Historial en tiempo real */}
            <div className="xl:col-span-4">
              <div className="sticky top-6 space-y-4">
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-slate-100" : "text-slate-800")}>
                      📊 Historial
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-bold",
                        isDark ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-200" : "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700"
                      )}>
                        {bitacora.length}
                      </span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="max-h-[70vh] overflow-y-auto space-y-3">
                    {bitacora.length === 0 ? (
                      <div className={cn("text-center py-8", isDark ? "text-slate-300" : "text-slate-600")}>
                        <div className="text-4xl mb-2">📝</div>
                        <div className="text-sm">Registra productos para ver el historial</div>
                      </div>
                    ) : (
                      bitacora.slice(-10).reverse().map((r, index) => (
                        <div
                          key={r.id || `item-${index}`}
                          className={cn(
                            "p-3 rounded-xl border-2 relative group",
                            isDark ? "bg-gradient-to-br from-white/10 to-white/5 border-white/20 hover:scale-[1.02]" : "bg-gradient-to-br from-white to-slate-50/80 border-slate-300 hover:scale-[1.02]"
                          )}
                        >
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 rounded text-red-500 hover:text-red-400"
                              onClick={() => eliminarRegistro(bitacora.length - 1 - index, r)}
                            >
                              🗑️
                            </Button>
                          </div>

                          <div className="pr-8">
                            <div className="font-semibold text-sm mb-1 line-clamp-2">{r.producto}</div>
                            <div className={cn("text-xs opacity-80 mb-2", isDark ? "text-slate-400" : "text-slate-500")}>
                              🏢 {r.proveedor || "-"} · 🏷️ {r.linea || "-"}
                            </div>

                            {/* Información de logística */}
                            <div className="grid grid-cols-3 gap-1 text-xs mb-2">
                              <div className={cn("px-1 py-1 rounded", isDark ? "bg-cyan-500/20" : "bg-cyan-50")}>
                                <div className="opacity-80">📦 Cajas</div>
                                <div className="font-bold">{r.cantidad_cajas || 0}</div>
                              </div>
                              <div className={cn("px-1 py-1 rounded", isDark ? "bg-purple-500/20" : "bg-purple-50")}>
                                <div className="opacity-80">🏷️ Lote</div>
                                <div className="font-bold text-xs">{r.lote || "-"}</div>
                              </div>
                              <div className={cn("px-1 py-1 rounded", isDark ? "bg-orange-500/20" : "bg-orange-50")}>
                                <div className="opacity-80">📅 Venc</div>
                                <div className="font-bold text-xs">{r.fecha_vencimiento ? new Date(r.fecha_vencimiento).toLocaleDateString("es-BO") : "-"}</div>
                              </div>
                            </div>
                            
                            {/* Precios principales */}
                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                              <div className={cn("px-2 py-1 rounded-lg", isDark ? "bg-amber-500/20" : "bg-amber-50")}>
                                <div className="opacity-80">💰 C.Final</div>
                                <div className="font-bold">Bs {nf.format(r.costo_final_caja ?? r["costo final"] ?? 0)}</div>
                              </div>
                              <div className={cn("px-2 py-1 rounded-lg", isDark ? "bg-emerald-500/20" : "bg-emerald-50")}>
                                <div className="opacity-80">🎯 P.Final</div>
                                <div className="font-bold text-emerald-600">Bs {nf.format(r.precio_final_caja ?? r["precio final"] ?? 0)}</div>
                              </div>
                            </div>

                            {/* Precio unitario destacado */}
                            <div className={cn("px-2 py-1 rounded-lg text-center", isDark ? "bg-blue-500/30 border border-blue-400/50" : "bg-blue-100 border border-blue-300")}>
                              <div className="opacity-90 text-xs">💊 Precio Unitario</div>
                              <div className={cn("font-bold", isDark ? "text-blue-200" : "text-blue-700")}>
                                Bs {nf.format(r.precio_final_unitario ?? 0)}
                              </div>
                            </div>

                            <div className={cn("text-xs mt-2 opacity-70", isDark ? "text-slate-400" : "text-slate-500")}>
                              📅 {r.fecha ? new Date(r.fecha).toLocaleString("es-BO") : "Sin fecha"}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>

                  <div className="px-6 pb-4">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => exportBitacora(bitacora)}
                        disabled={bitacora.length === 0}
                        className={cn(
                          "flex-1 rounded-xl text-xs",
                          bitacora.length === 0
                            ? "opacity-50 cursor-not-allowed"
                            : isDark ? "bg-emerald-600/80 hover:bg-emerald-600 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Exportar
                      </Button>
                      <Button
                        size="sm"
                        onClick={finalizarSesion}
                        disabled={!sesionActual || bitacora.length === 0}
                        className={cn(
                          "flex-1 rounded-xl text-xs",
                          !sesionActual || bitacora.length === 0
                            ? "opacity-50 cursor-not-allowed"
                            : isDark ? "bg-purple-600/80 hover:bg-purple-600 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"
                        )}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Finalizar
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>

            {/* PIE DE PÁGINA DEL MÓDULO DE MÁRGENES */}
            <footer className={cn("text-center py-8 space-y-2", isDark ? "text-slate-300" : "text-slate-600")}>
              <div className="text-2xl">💊</div>
              <div className="text-sm font-semibold">FarmaClinic · Módulo de Márgenes · {new Date().getFullYear()}</div>
              <div className="text-xs opacity-75">Sistema Profesional de Gestión de Precios Farmacéuticos</div>
            </footer>
          </div>
        )}

        {/* VISTA DEL MÓDULO DE REVISIÓN */}
        {vistaActiva === "revision" && (
          <div className="relative mx-auto max-w-screen-2xl p-4 md:p-6 space-y-6">
            {/* Encabezado del módulo de revisión */}
            <header>
              <h1
                className={cn(
                  "text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent drop-shadow-2xl",
                  isDark
                    ? "bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300"
                    : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600"
                )}
              >
                ⚖️ Módulo de Revisión
              </h1>
              <p
                className={cn(
                  "mt-2 text-lg font-medium",
                  isDark ? "text-slate-300/90" : "text-slate-600"
                )}
              >
                Comparación de precios y toma de decisiones
              </p>
            </header>

            {/* Layout de dos columnas para revisión */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna izquierda: Lista de sesiones/facturas pendientes */}
              <div className="lg:col-span-4">
                <Card className={cardClass}>
                  <CardHeader className="pb-2">
                    <CardTitle className={cn("text-lg font-bold", isDark ? "text-slate-100" : "text-slate-800")}>
                      🧾 Facturas/Sesiones ({sesionesPendientes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sesionesPendientes.length === 0 && (
                      <div className={cn("text-sm py-8 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                        No hay facturas para revisar.
                      </div>
                    )}
                    <div className="space-y-2">
                      {sesionesPendientes.map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            "p-3 rounded-xl border-2 transition-all duration-200 group",
                            sesionEnRevision?.id === s.id
                              ? (isDark
                                  ? "bg-emerald-500/20 border-emerald-400/40"
                                  : "bg-emerald-50 border-emerald-300")
                              : (isDark
                                  ? "bg-white/5 border-white/15 hover:bg-white/10"
                                  : "bg-white border-slate-200 hover:bg-slate-50")
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => abrirSesionParaRevision(s)}
                              className="flex-1 text-left"
                            >
                              <div className="font-semibold mb-1">{s.nombre}</div>
                              <div className={cn("text-xs mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                                📅 {s.fecha_finalizacion ? new Date(s.fecha_finalizacion).toLocaleString("es-BO") : "En proceso"}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded-lg",
                                  isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"
                                )}>
                                  📦 {s.total_productos ?? 0} productos
                                </span>
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded-lg",
                                  s.estado === "enviada_revision" 
                                    ? (isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700")
                                    : (isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700")
                                )}>
                                  {s.estado === "enviada_revision" ? "⏳ Pendiente" : "✅ Revisada"}
                                </span>
                              </div>
                            </button>
                            
                            <button
                              onClick={async () => {
                                if (window.confirm(`¿Eliminar la sesión "${s.nombre}"? Esta acción no se puede deshacer.`)) {
                                  try {
                                    const { error } = await supabase
                                      .from('sesiones_trabajo')
                                      .delete()
                                      .eq('id', s.id);
                                    if (error) throw error;
                                    if (sesionEnRevision?.id === s.id) {
                                      setSesionEnRevision(null);
                                      setProductosRevision([]);
                                    }
                                    cargarSesionesPendientes();
                                  } catch (e) {
                                    console.error(e);
                                    alert('No se pudo eliminar la sesión.');
                                  }
                                }
                              }}
                              className={cn(
                                "p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                isDark ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-100 text-red-600"
                              )}
                              title="Eliminar sesión"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Columna derecha: Detalle de la factura seleccionada */}
              <div className="lg:col-span-8">
                {!sesionEnRevision ? (
                  <Card className={cardClass}>
                    <CardContent className={cn("py-12 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                      <div className="text-6xl mb-4">👈</div>
                      Selecciona una factura para revisar.
                    </CardContent>
                  </Card>
                ) : (
                  <Card className={cardClass}>
                    {/* Encabezado con controles globales */}
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between mb-4">
                        <CardTitle className={cn("text-lg font-bold", isDark ? "text-slate-100" : "text-slate-800")}>
                          🧾 {sesionEnRevision.nombre}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={exportarDecisionesExcel}
                            className={cn(
                              "rounded-xl px-3 py-2",
                              isDark ? "bg-blue-600/80 hover:bg-blue-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
                            )}
                          >
                            📊 Exportar
                          </Button>
                          <Button
                            onClick={finalizarRevisionActual}
                            className={cn(
                              "rounded-xl px-3 py-2",
                              isDark ? "bg-emerald-600/80 hover:bg-emerald-600 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                          >
                            ✅ Finalizar
                          </Button>
                        </div>
                      </div>

                      {/* Panel de guardado global */}
                      {productosRevision.length > 0 && (
                        <div className={cn(
                          "p-4 rounded-2xl border-2 text-center",
                          isDark ? "bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-400/30" : "bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-300"
                        )}>
                          <div className="text-sm font-bold mb-3">💾 Guardado de Decisiones</div>
                          <div className="flex items-center justify-center gap-3">
                            <input
                              type="text"
                              placeholder="Observaciones generales de la sesión..."
                              className={cn(
                                "flex-1 h-10 px-3 rounded-xl bg-transparent border",
                                isDark ? "border-white/20" : "border-slate-300"
                              )}
                              value={decisiones.observaciones_global || ""}
                              onChange={(e) => setDecisiones(prev => ({...prev, observaciones_global: e.target.value}))}
                            />
                            <Button
                              onClick={guardarTodasLasDecisiones}
                              className={cn(
                                "px-6 py-2 rounded-xl font-bold",
                                isDark ? "bg-purple-600/80 hover:bg-purple-600 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"
                              )}
                            >
                              💾 Guardar Todas las Decisiones
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {productosRevision.length === 0 ? (
                        <div className={cn("py-12 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                          Cargando productos...
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {productosRevision.map((r) => {
                            // Cálculos de precios
                            const code = r.codigo_barras || r.cod_ref;
                            const ps = preciosSistema[code];
                            const precioNuevo = r.precio_final_unitario ?? 0;
                            const precioAnteriorSistema = ps?.precio_caja ? (ps.precio_caja / (r.unidades_por_caja || 1)) : null;
                            const precioAnteriorEditado = decisiones[`precio_anterior_${r.id}`] ? Number(decisiones[`precio_anterior_${r.id}`]) : null;
                            const precioAnterior = precioAnteriorEditado || precioAnteriorSistema;
                            
                            // Cálculo del precio final según decisión
                            const decisionProducto = decisiones[`decision_${r.id}`];
                            let precioFinal = precioNuevo;
                            
                            if (decisionProducto === 'usar_anterior' && precioAnterior) {
                              precioFinal = precioAnterior;
                            } else if (decisionProducto === 'promediar' && precioAnterior) {
                              precioFinal = (precioNuevo + precioAnterior) / 2;
                            }

                            const diferencia = precioAnterior ? ((precioNuevo - precioAnterior) / precioAnterior * 100) : null;

                            return (
                              <div
                                key={r.id}
                                className={cn(
                                  "p-5 rounded-3xl border-2",
                                  isDark ? "bg-white/5 border-white/15" : "bg-white border-slate-200"
                                )}
                              >
                                {/* Encabezado del producto con información completa */}
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="font-bold text-lg mb-2">{r.producto}</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-blue-500/20" : "bg-blue-50")}>
                                        <span className="opacity-80">🏢 Proveedor:</span>
                                        <div className="font-semibold">{r.proveedor || "-"}</div>
                                      </div>
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-purple-500/20" : "bg-purple-50")}>
                                        <span className="opacity-80">🏷️ Línea:</span>
                                        <div className="font-semibold">{r.linea || "-"}</div>
                                      </div>
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-green-500/20" : "bg-green-50")}>
                                        <span className="opacity-80">📦 Cajas:</span>
                                        <div className="font-semibold">{r.cantidad_cajas || 0}</div>
                                      </div>
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-cyan-500/20" : "bg-cyan-50")}>
                                        <span className="opacity-80">💊 Unidades:</span>
                                        <div className="font-semibold">{r.cantidad_unidades || 0}</div>
                                      </div>
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-amber-500/20" : "bg-amber-50")}>
                                        <span className="opacity-80">🏷️ Lote:</span>
                                        <div className="font-semibold">{r.lote || "-"}</div>
                                      </div>
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-red-500/20" : "bg-red-50")}>
                                        <span className="opacity-80">📅 Vencimiento:</span>
                                        <div className="font-semibold">{r.fecha_vencimiento ? new Date(r.fecha_vencimiento).toLocaleDateString("es-BO") : "-"}</div>
                                      </div>
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-slate-500/20" : "bg-slate-50")}>
                                        <span className="opacity-80">📊 Código Barras:</span>
                                        <div className="font-semibold">{r.codigo_barras || "-"}</div>
                                      </div>
                                      <div className={cn("px-2 py-1 rounded", isDark ? "bg-indigo-500/20" : "bg-indigo-50")}>
                                        <span className="opacity-80">🔖 Código Ref:</span>
                                        <div className="font-semibold">{r.cod_ref || "-"}</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {diferencia !== null && (
                                    <div className={cn(
                                      "px-3 py-2 rounded-xl font-bold text-center",
                                      diferencia > 5 
                                        ? (isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700")
                                        : diferencia < -5
                                        ? (isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-700")
                                        : (isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700")
                                    )}>
                                      <div className="text-xl">{diferencia > 0 ? "📈" : diferencia < 0 ? "📉" : "📊"}</div>
                                      <div className="text-xs">{diferencia.toFixed(1)}%</div>
                                    </div>
                                  )}
                                </div>

                                {/* Comparación de precios unitarios */}
                                <div className="grid grid-cols-4 gap-3 mb-4">
                                  <div className={cn("p-3 text-center rounded-xl", isDark ? "bg-slate-500/20" : "bg-slate-50")}>
                                    <div className="text-xs opacity-80 mb-1">💰 Precio Anterior</div>
                                    <div className="font-bold mb-2">
                                      {precioAnterior ? `Bs ${nf.format(precioAnterior)}` : "—"}
                                    </div>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="Editable"
                                      className={cn(
                                        "w-full h-8 px-2 rounded text-xs bg-transparent border",
                                        isDark ? "border-white/20" : "border-slate-300"
                                      )}
                                      value={decisiones[`precio_anterior_${r.id}`] || ""}
                                      onChange={(e) => setDecisiones(prev => ({
                                        ...prev,
                                        [`precio_anterior_${r.id}`]: e.target.value
                                      }))}
                                    />
                                  </div>
                                  
                                  <div className={cn("p-3 text-center rounded-xl", isDark ? "bg-blue-500/20" : "bg-blue-50")}>
                                    <div className="text-xs opacity-80 mb-1">🆕 Precio Nuevo</div>
                                    <div className={cn("font-bold text-xl", isDark ? "text-blue-300" : "text-blue-600")}>
                                      Bs {nf.format(precioNuevo)}
                                    </div>
                                  </div>
                                  
                                  <div className={cn("p-3 text-center rounded-xl", isDark ? "bg-amber-500/20" : "bg-amber-50")}>
                                    <div className="text-xs opacity-80 mb-1">⚖️ Promedio</div>
                                    <div className="font-bold">
                                      {precioAnterior ? `Bs ${nf.format((precioNuevo + precioAnterior) / 2)}` : "—"}
                                    </div>
                                  </div>
                                  
                                  <div className={cn(
                                    "p-3 text-center rounded-xl border-2",
                                    isDark ? "bg-emerald-500/20 border-emerald-400/50" : "bg-emerald-50 border-emerald-300"
                                  )}>
                                    <div className="text-xs opacity-80 mb-1">🎯 Precio Final</div>
                                    <div className={cn("font-bold text-xl", isDark ? "text-emerald-300" : "text-emerald-600")}>
                                      Bs {nf.format(precioFinal)}
                                    </div>
                                  </div>
                                </div>

                                {/* Botones de decisión individual */}
                                <div className="flex items-center justify-center gap-3 mb-3">
                                  <button
                                    onClick={() => setDecisiones(prev => ({...prev, [`decision_${r.id}`]: 'usar_anterior'}))}
                                    className={cn(
                                      "p-3 rounded-2xl border-2 transition-all hover:scale-105",
                                      decisiones[`decision_${r.id}`] === 'usar_anterior'
                                        ? (isDark ? "bg-blue-500/30 border-blue-400" : "bg-blue-100 border-blue-400")
                                        : (isDark ? "bg-white/10 border-white/20 hover:bg-white/15" : "bg-white border-slate-300 hover:bg-slate-50")
                                    )}
                                  >
                                    <div className="text-xl">⬇️</div>
                                    <div className="text-xs font-semibold">Anterior</div>
                                  </button>
                                  
                                  <button
                                    onClick={() => setDecisiones(prev => ({...prev, [`decision_${r.id}`]: 'usar_nuevo'}))}
                                    className={cn(
                                      "p-3 rounded-2xl border-2 transition-all hover:scale-105",
                                      decisiones[`decision_${r.id}`] === 'usar_nuevo'
                                        ? (isDark ? "bg-emerald-500/30 border-emerald-400" : "bg-emerald-100 border-emerald-400")
                                        : (isDark ? "bg-white/10 border-white/20 hover:bg-white/15" : "bg-white border-slate-300 hover:bg-slate-50")
                                    )}
                                  >
                                    <div className="text-xl">⬆️</div>
                                    <div className="text-xs font-semibold">Nuevo</div>
                                  </button>
                                  
                                  <button
                                    onClick={() => setDecisiones(prev => ({...prev, [`decision_${r.id}`]: 'promediar'}))}
                                    className={cn(
                                      "p-3 rounded-2xl border-2 transition-all hover:scale-105",
                                      decisiones[`decision_${r.id}`] === 'promediar'
                                        ? (isDark ? "bg-amber-500/30 border-amber-400" : "bg-amber-100 border-amber-400")
                                        : (isDark ? "bg-white/10 border-white/20 hover:bg-white/15" : "bg-white border-slate-300 hover:bg-slate-50")
                                    )}
                                  >
                                    <div className="text-xl">⚖️</div>
                                    <div className="text-xs font-semibold">Promediar</div>
                                  </button>
                                  
                                  <button
                                    onClick={() => setDecisiones(prev => ({...prev, [`decision_${r.id}`]: 'reprocesar'}))}
                                    className={cn(
                                      "p-3 rounded-2xl border-2 transition-all hover:scale-105",
                                      decisiones[`decision_${r.id}`] === 'reprocesar'
                                        ? (isDark ? "bg-orange-500/30 border-orange-400" : "bg-orange-100 border-orange-400")
                                        : (isDark ? "bg-white/10 border-white/20 hover:bg-white/15" : "bg-white border-slate-300 hover:bg-slate-50")
                                    )}
                                  >
                                    <div className="text-xl">🔄</div>
                                    <div className="text-xs font-semibold">Reprocesar</div>
                                  </button>
                                </div>

                                {/* Campo de observaciones individual */}
                                <input
                                  type="text"
                                  placeholder="Observaciones específicas del producto..."
                                  className={cn(
                                    "w-full h-10 px-3 rounded-xl bg-transparent border",
                                    isDark ? "border-white/20" : "border-slate-300"
                                  )}
                                  value={decisiones[`observacion_${r.id}`] || ""}
                                  onChange={(e) => setDecisiones(prev => ({
                                    ...prev,
                                    [`observacion_${r.id}`]: e.target.value
                                  }))}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VISTA DEL MÓDULO DE HISTORIAL */}
        {vistaActiva === "historial" && (
          <div className="relative mx-auto max-w-screen-2xl p-4 md:p-6 space-y-6">
            <header>
              <h1
                className={cn(
                  "text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent drop-shadow-2xl",
                  isDark
                    ? "bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300"
                    : "bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600"
                )}
              >
                🗂️ Historial de Decisiones
              </h1>
              <p
                className={cn(
                  "mt-2 text-lg font-medium",
                  isDark ? "text-slate-300/90" : "text-slate-600"
                )}
              >
                Búsqueda y exportación de decisiones guardadas
              </p>
            </header>

            {/* Filtros de búsqueda */}
            <Card className={cardClass}>
              <CardHeader className="pb-3">
                <CardTitle className={cn("text-lg font-bold", isDark ? "text-slate-100" : "text-slate-800")}>
                  🔍 Filtros de Búsqueda
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Buscar por producto, proveedor..."
                  className={cn(
                    "h-10 px-3 rounded-xl bg-transparent border",
                    isDark ? "border-white/20" : "border-slate-300"
                  )}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
                  <SelectTrigger className={cn(
                    "rounded-xl",
                    isDark ? "bg-white/10 border-white/20" : "bg-white border-slate-300"
                  )}>
                    <SelectValue placeholder="Todos los proveedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los proveedores</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase
                        .from("decisiones_comparacion")
                        .select(`
                          *,
                          historial_calculos!inner(
                            producto,
                            proveedor,
                            linea,
                            codigo_barras,
                            cod_ref,
                            cantidad_cajas,
                            cantidad_unidades,
                            lote,
                            fecha_vencimiento,
                            unidades_por_caja
                          )
                        `)
                        .order('fecha_decision', { ascending: false });
                      if (error) throw error;
                      setDecisionesHistorial(data || []);
                    } catch (e) {
                      console.error("Error cargando historial:", e);
                      alert("No se pudo cargar el historial de decisiones.");
                    }
                  }}
                  className={cn(
                    "rounded-xl",
                    isDark ? "bg-blue-600/80 hover:bg-blue-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  🔄 Cargar Historial
                </Button>
              </CardContent>
            </Card>

            {/* Lista de decisiones */}
            <Card className={cardClass}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className={cn("text-lg font-bold", isDark ? "text-slate-100" : "text-slate-800")}>
                    📋 Decisiones Guardadas ({decisionesHistorial.length})
                  </CardTitle>
                  <Button
                    onClick={async () => {
                      if (decisionesHistorial.length === 0) {
                        alert("No hay decisiones para exportar.");
                        return;
                      }
                      try {
                        const XLSX = await import("xlsx");
                        const excelData = decisionesHistorial.map((d, i) => ({
                          "#": i + 1,
                          "Fecha Decisión": new Date(d.fecha_decision).toLocaleString("es-BO"),
                          "Producto": d.historial_calculos?.producto || "-",
                          "Proveedor": d.historial_calculos?.proveedor || "-",
                          "Línea": d.historial_calculos?.linea || "-",
                          "Código Barras": d.codigo_barras || "-",
                          "Código Ref": d.cod_ref || "-",
                          "Cantidad Cajas": d.historial_calculos?.cantidad_cajas || 0,
                          "Lote": d.historial_calculos?.lote || "-",
                          "Vencimiento": d.historial_calculos?.fecha_vencimiento || "-",
                          "Acción Tomada": d.accion_tomada || "-",
                          "Precio Sistema (Bs)": Number(d.precio_sistema_unitario || 0).toFixed(2),
                          "Precio Calculado (Bs)": Number(d.precio_calculado_unitario || 0).toFixed(2),
                          "Precio Final Aprobado (Bs)": Number(d.precio_final_aprobado || 0).toFixed(2),
                          "Usuario Revisor": d.usuario_revisor || "-",
                          "Observaciones": d.observaciones || "-",
                          "Sucursal": d.sucursal || "-"
                        }));
                        
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.json_to_sheet(excelData);
                        ws["!cols"] = Array(16).fill({ wch: 15 });
                        XLSX.utils.book_append_sheet(wb, ws, "Historial Decisiones");
                        
                        const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
                        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `historial_decisiones_${new Date().toISOString().slice(0,10)}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error("Error exportando:", e);
                        alert("No se pudo exportar el historial.");
                      }
                    }}
                    disabled={decisionesHistorial.length === 0}
                    className={cn(
                      "rounded-xl",
                      decisionesHistorial.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : isDark ? "bg-emerald-600/80 hover:bg-emerald-600 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                  >
                    📊 Exportar Excel
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {loadingDecisiones ? (
                  <div className={cn("py-12 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                    <div className="text-4xl mb-2">⏳</div>
                    Cargando decisiones...
                  </div>
                ) : decisionesHistorial.length === 0 ? (
                  <div className={cn("py-12 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                    <div className="text-4xl mb-2">📭</div>
                    <div className="text-lg font-semibold mb-2">Sin decisiones guardadas</div>
                    <div className="text-sm">Las decisiones aparecerán aquí después de guardarlas en el módulo de revisión</div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                    {decisionesHistorial.map((d) => (
                      <div
                        key={d.id}
                        className={cn(
                          "p-4 rounded-2xl border-2",
                          isDark ? "bg-white/5 border-white/15" : "bg-white border-slate-200"
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-bold text-lg">{d.historial_calculos?.producto || "Producto sin nombre"}</div>
                            <div className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                              🏢 {d.historial_calculos?.proveedor || "-"} · 🏷️ {d.historial_calculos?.linea || "-"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                              📅 {new Date(d.fecha_decision).toLocaleString("es-BO")}
                            </div>
                            <div className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                              👤 {d.usuario_revisor}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                          <div className={cn("px-2 py-1 rounded", isDark ? "bg-green-500/20" : "bg-green-50")}>
                            <span className="opacity-80">📦 Cajas:</span>
                            <div className="font-semibold">{d.historial_calculos?.cantidad_cajas || 0}</div>
                          </div>
                          <div className={cn("px-2 py-1 rounded", isDark ? "bg-amber-500/20" : "bg-amber-50")}>
                            <span className="opacity-80">🏷️ Lote:</span>
                            <div className="font-semibold">{d.historial_calculos?.lote || "-"}</div>
                          </div>
                          <div className={cn("px-2 py-1 rounded", isDark ? "bg-red-500/20" : "bg-red-50")}>
                            <span className="opacity-80">📅 Vencimiento:</span>
                            <div className="font-semibold">
                              {d.historial_calculos?.fecha_vencimiento 
                                ? new Date(d.historial_calculos.fecha_vencimiento).toLocaleDateString("es-BO") 
                                : "-"}
                            </div>
                          </div>
                          <div className={cn("px-2 py-1 rounded", isDark ? "bg-slate-500/20" : "bg-slate-50")}>
                            <span className="opacity-80">📊 Código:</span>
                            <div className="font-semibold">{d.codigo_barras || d.cod_ref || "-"}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className={cn("p-2 text-center rounded-xl", isDark ? "bg-slate-500/20" : "bg-slate-50")}>
                            <div className="text-xs opacity-80">💰 Sistema</div>
                            <div className="font-bold">Bs {nf.format(d.precio_sistema_unitario || 0)}</div>
                          </div>
                          <div className={cn("p-2 text-center rounded-xl", isDark ? "bg-blue-500/20" : "bg-blue-50")}>
                            <div className="text-xs opacity-80">🆕 Calculado</div>
                            <div className="font-bold">Bs {nf.format(d.precio_calculado_unitario || 0)}</div>
                          </div>
                          <div className={cn("p-2 text-center rounded-xl", isDark ? "bg-emerald-500/20" : "bg-emerald-50")}>
                            <div className="text-xs opacity-80">🎯 Final</div>
                            <div className="font-bold text-emerald-600">Bs {nf.format(d.precio_final_aprobado || 0)}</div>
                          </div>
                          <div className={cn(
                            "p-2 text-center rounded-xl",
                            d.accion_tomada === 'usar_anterior' 
                              ? (isDark ? "bg-blue-500/20" : "bg-blue-50")
                              : d.accion_tomada === 'usar_nuevo'
                              ? (isDark ? "bg-emerald-500/20" : "bg-emerald-50")
                              : d.accion_tomada === 'promediar'
                              ? (isDark ? "bg-amber-500/20" : "bg-amber-50")
                              : (isDark ? "bg-orange-500/20" : "bg-orange-50")
                          )}>
                            <div className="text-xs opacity-80">Decisión</div>
                            <div className="font-bold text-xs">
                              {d.accion_tomada === 'usar_anterior' ? '⬇️ Anterior' :
                               d.accion_tomada === 'usar_nuevo' ? '⬆️ Nuevo' :
                               d.accion_tomada === 'promediar' ? '⚖️ Promedio' :
                               d.accion_tomada === 'reprocesar' ? '🔄 Reprocesar' : d.accion_tomada}
                            </div>
                          </div>
                        </div>

                        {d.observaciones && (
                          <div className={cn("text-xs p-2 rounded-lg", isDark ? "bg-white/10" : "bg-slate-50")}>
                            <span className="opacity-80">💬 Observaciones:</span> {d.observaciones}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
