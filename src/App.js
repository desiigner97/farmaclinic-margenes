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

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN INICIAL DE SUPABASE Y CONSTANTES DEL SISTEMA
// ═══════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════
// 2. UTILIDADES DE FORMATEO Y CONVERSIÓN NUMÉRICA
// ═══════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DATOS DEMO Y MUESTRAS PARA DESARROLLO
// ═══════════════════════════════════════════════════════════════════════════════
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
// ═══════════════════════════════════════════════════════════════════════════════
// 4. SISTEMA DE NORMALIZACIÓN DE CABECERAS DE ARCHIVOS CSV/XLSX
// ═══════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PROCESADORES DE ARCHIVOS - PARSEADORES CSV Y XLSX
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ALGORITMO DE CÁLCULO DE DESCUENTOS EN CASCADA
// ═══════════════════════════════════════════════════════════════════════════════
function aplicarDescuentosProveedor(c, d1 = 0, d2 = 0) {
  const D1 = Math.min(Math.max(Number(d1) || 0, 0), 1);
  const D2 = Math.min(Math.max(Number(d2) || 0, 0), 1);
  return Number(c || 0) * (1 - D1) * (1 - D2);
}
// ═══════════════════════════════════════════════════════════════════════════════
// 7. SISTEMA DE EXPORTACIÓN A EXCEL CON FORMATO Y RESUMEN ESTADÍSTICO
// ═══════════════════════════════════════════════════════════════════════════════
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
      "Cantidad (Cajas)": Number(r.cantidad_cajas ?? 0),           // nuevo
      "Cantidad (Unidades)": Number(r.cantidad_unidades ?? 0),     // nuevo
      "Lote": r.lote ?? "",                                        // nuevo
      "Vencimiento": r.fecha_vencimiento ?? "",                    // nuevo
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
// ═══════════════════════════════════════════════════════════════════════════════
// 8. COMPONENTE PRINCIPAL - FARMACLINIC MÁRGENES - INICIO
// ═══════════════════════════════════════════════════════════════════════════════
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
        usuario_revisor: row.usuario_revisor ?? usuario?.email ?? "revisor",
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
      const sessionId = sesionEnRevision?.id ?? sesionActual?.id;
      if (!sessionId) {
        alert("No hay sesión activa ni en revisión.");
        return;
      }
      if (!decisiones || typeof decisiones !== "object" || Object.keys(decisiones).length === 0) {
        alert("No hay decisiones para guardar.");
        return;
      }
      const rows = Object.entries(decisiones).map(([historialId, row]) => ({
        session_id: sessionId,
        historial_id: historialId,
        decision: row.decision ?? row.accion_tomada ?? null,
        precio_final: row.precio_final ?? row.precio_final_aprobado ?? null,
        precio_erp_usado: row.precio_erp_usado ?? row.erp_unitario_usado ?? null,
        precio_calculado_usado: row.precio_calculado_usado ?? row.calc_unitario_usado ?? null,
        motivo: row.motivo ?? row.observaciones ?? null,
        usuario_revisor: row.usuario_revisor ?? usuario?.email ?? "revisor",
        fecha_decision: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("revision_lineas")
        .upsert(rows, { onConflict: "session_id,historial_id" });
      if (error) throw error;
      alert(`Se guardaron ${rows.length} decisiones.`);
      if (typeof cargarDecisionesDeSesion === "function") {
        await cargarDecisionesDeSesion();
      }
    } catch (e) {
      console.error("guardarTodasLasDecisiones() error:", e);
      alert("No se pudieron guardar todas las decisiones.");
    }
  }

  async function cargarSesionesPendientes() {
    try {
      const estadosPendientes = ['enviada_revision', 'finalizada'];
      const { data, error } 

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8.1. ESTADOS PRINCIPALES DEL SISTEMA
  // ═══════════════════════════════════════════════════════════════════════════════
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

  // 8.4. ESTADO DE LA SESIÓN DE TRABAJO ACTUAL
  const [sesionActual, setSesionActual] = useState(null);

  // 15.2. Estados para eliminación con undo
  const undoTimerRef = useRef(null);
  const [undo, setUndo] = useState(null);
  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. SISTEMA DE GESTIÓN DE TEMA VISUAL (DARK/LIGHT MODE)
  // ═══════════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 10. GENERACIÓN AUTOMÁTICA DE LISTAS ÚNICAS PARA FILTROS
  // ═══════════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 11. MANEJADOR DE CARGA DE ARCHIVOS CSV/XLSX
  // ═══════════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 12. GESTIÓN DE SESIONES DE TRABAJO - CREAR, CARGAR, FINALIZAR
  // ═══════════════════════════════════════════════════════════════════════════════

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
// [REMOVED duplicate function cargarSesionesPendientes]
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
  // ═══════════════════════════════════════════════════════════════════════════════
  // 13. FUNCIONES AUXILIARES PARA EL MÓDULO DE REVISIÓN
  // ═══════════════════════════════════════════════════════════════════════════════

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

      // 2) (Opcional) Cargar precios "oficiales" si tienes tabla precios_sistema
      const cods = (filas || []).flatMap(r => [r.codigo_barras, r.cod_ref]).filter(Boolean);
      if (cods.length) {
        const { data: ps, error: e2 } = await supabase
          .from('precios_sistema')
          .select('*')
          .in('codigo_barras', cods);
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
      } else {
        setPreciosSistema({});
      }
      setDecisiones({});
    } catch (err) {
      console.error('Error abriendo sesión en revisión:', err);
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

  // 13.8. Cargar decisiones de la sesión actual (Supabase) — VERSION CORRECTA
// [REMOVED duplicate function cargarDecisionesDeSesion]
// 13.4. Finalizador del proceso de revisión completo
  async function finalizarRevisionActual() {
    if (!sesionEnRevision) return;
    try {
      const { error } = await supabase
        .from('sesiones_trabajo')
        .update({ estado: 'revisada' })
        .eq('id', sesionEnRevision.id);
      if (error) throw error;
      alert('Sesión marcada como revisada.');
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
  
  // [REMOVED old cargarDecisionesDeSesion that pointed to 'revision_decisiones']


  // ═══════════════════════════════════════════════════════════════════════════════
  // 14. SISTEMA DE REGISTRO Y VALIDACIÓN EN BITÁCORA
  // ═══════════════════════════════════════════════════════════════════════════════

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

  // 14.2. Registrador principal en bitácora con persistencia en Supabase
  async function registrarEnBitacora(p) {
  try {
    if (!sesionActual?.id) {
      alert("No hay sesión activa. Crea una sesión antes de registrar.");
      return;
    }

    const entered = costosIngresados[p.id] || {};
    const upc = isFinite(p.unidades_por_caja) && p.unidades_por_caja > 0 ? Number(p.unidades_por_caja) : 1;

    // Validaciones ligeras
    if (entered.cantidad_cajas !== undefined && entered.cantidad_cajas !== "" && Number(entered.cantidad_cajas) < 0) {
      alert("La cantidad de cajas no puede ser negativa.");
      return;
    }
    if (entered.lote && entered.lote.length > 40) {
      alert("El código de lote es demasiado largo (máx. 40).");
      return;
    }
    if (entered.fecha_vencimiento) {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(entered.fecha_vencimiento);
      if (!ok) {
        alert("La fecha de vencimiento debe tener formato YYYY-MM-DD.");
        return;
      }
    }

    const cajas = (entered.cantidad_cajas === "" || entered.cantidad_cajas === undefined)
      ? 0
      : Number(entered.cantidad_cajas) || 0;

    const cantidadUnidades = (() => {
      const upcSafe = isFinite(upc) && upc > 0 ? upc : 1;
      return cajas * upcSafe;
    })();

    const row = {
      session_id: sesionActual.id,
      producto: p.producto,
      proveedor: p.proveedor,
      linea: p.linea,
      codigo_barras: p.codigo_barras || null,
      cod_ref: p.cod_ref || null,
      unidades_por_caja: upc,
      costo_caja: Number(p.costo_caja ?? p.costo ?? 0) || 0,
      desc1_pct: Number(p.desc1_pct ?? 0) || 0,
      desc2_pct: Number(p.desc2_pct ?? 0) || 0,
      incremento_pct: Number(p.incremento_pct ?? 0) || 0,
      costo_final_caja: Number(p.costo_final_caja ?? p["costo final"] ?? 0) || 0,
      precio_final_unitario: Number(p.precio_final_unitario ?? 0) || 0,

      // Nuevos campos (fase 1)
      cantidad_cajas: cajas,
      cantidad_unidades: cantidadUnidades,
      lote: entered.lote || null,
      fecha_vencimiento: entered.fecha_vencimiento || null,

      // Estado para revisión
      estado: "pendiente_revision",
    };

    // Insert en Supabase
    const { error: errIns } = await supabase.from("historial_calculos").insert(row);
    if (errIns) {
      console.error("Error insertando en historial_calculos:", errIns);
      alert("No se pudo registrar en el historial.");
      return;
    }

    // Refresco local (si mantienes bitácora en memoria)
    setBitacora((prev) => [
      ...prev,
      { id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), ...row },
    ]);

    // Limpieza de los tres nuevos inputs
    setCostosIngresados((prev) => ({
      ...prev,
      [p.id]: { ...(prev[p.id] || {}), cantidad_cajas: "", lote: "", fecha_vencimiento: "" },
    }));

    alert("Registro agregado a la bitácora.");
  } catch (e) {
    console.error("registrarEnBitacora() exception:", e);
    alert("Ocurrió un error inesperado al registrar.");
  }
}

  // ═══════════════════════════════════════════════════════════════════════════════
  // 15. SISTEMA DE DRAG & DROP Y MANIPULACIÓN DE HISTORIAL
  // ═══════════════════════════════════════════════════════════════════════════════

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
        alert("❌ No se pudo eliminar en la base de datos. Se revierte el cambio local.");
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
      `Neto Caja: Bs ${nf.format(netoC)} | Neto U: Bs ${nf.format(netoU)}`,
      `Final Caja: Bs ${nf.format(finalC)} | Final U: Bs ${nf.format(finalU)}`,
    ].join("\n");
    navigator.clipboard.writeText(texto);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 16. DEFINICIÓN DE CLASES CSS Y ESTILOS DINÁMICOS
  // ═══════════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 17. COMPONENTE DE BARRA LATERAL DE NAVEGACIÓN
  // ═══════════════════════════════════════════════════════════════════════════════
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
// ═══════════════════════════════════════════════════════════════════════════════
  // 18. RENDER PRINCIPAL DEL COMPONENTE
  // ═══════════════════════════════════════════════════════════════════════════════
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
            {/* ═══════════════════════════════════════════════════════════════════════════════
            // 19. SECCIÓN DE ENCABEZADO PRINCIPAL DEL MÓDULO DE MÁRGENES
            // ═══════════════════════════════════════════════════════════════════════════════ */}
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

              {/* 19.1. Botones de acción principales del header */}
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

            {/* ═══════════════════════════════════════════════════════════════════════════════
            // 20. SECCIÓN DE FILTROS Y BÚSQUEDA
            // ═══════════════════════════════════════════════════════════════════════════════ */}
            <Card className={cardClass}>
              <CardHeader className="pb-3 sticky top-0 z-10 backdrop-blur-xl">
                <CardTitle className={cn("text-xl font-bold flex items-center gap-2", isDark ? "text-slate-100" : "text-slate-800")}>
                  <Search className="h-5 w-5" />
                  Buscar y filtrar
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:grid md:grid-cols-12 md:items-center">
                {/* 20.1. Input de búsqueda por texto libre */}
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

                {/* 20.2. Selector de filtro por proveedor */}
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

                {/* 20.3. Selector de filtro por línea/marca */}
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

                {/* 20.4. Controles adicionales de vista */}
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
{/* ═══════════════════════════════════════════════════════════════════════════════
            // 21. SECCIÓN PRINCIPAL DE TARJETAS DE PRODUCTOS
            // ═══════════════════════════════════════════════════════════════════════════════ */}
            <div className="space-y-6">
              {filtrados.map((p) => {
                // 21.1. Cálculo de valores base y procesamiento de overrides
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

                // 21.2. Aplicación del algoritmo de descuentos en cascada
                const netoC = aplicarDescuentosProveedor(baseC, d1, d2);
                const finalC = netoC * (1 + inc);
                const netoU = aplicarDescuentosProveedor(baseU, d1, d2);
                const finalU = netoU * (1 + inc);

                const caso = (p.caso_especial || "").toString().trim().toLowerCase();

                return (
                  <Card key={p.id} className={cn(cardClass, "card-hover")}>
                    <CardContent className="p-5 md:p-6">
                      {/* 21.3. Cabecera de la tarjeta con información del producto */}
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

                        {/* 21.4. Chip indicador de estado del producto */}
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

                      {/* 21.5. Grid principal de edición y resultados */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* 21.6. Panel de inputs para edición de valores */}
                        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                          {/* 21.6.1. Input principal para costo por caja */}
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
{/* 21.6.2. Grid de inputs para descuentos e incremento */}
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
                                  {/* 21.X. Captura logística: Cantidad (cajas), Lote y Vencimiento */}
<div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
  {/* Cantidad (cajas) */}
  <div className={cn("flex flex-col gap-1")}>
    <label className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
      Cantidad (cajas)
    </label>
    <input
      type="number"
      min={0}
      step="1"
      className={cn(
        "rounded-xl px-3 py-2 border focus:outline-none focus:ring",
        isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
      )}
      placeholder="0"
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

  {/* Lote */}
  <div className={cn("flex flex-col gap-1")}>
    <label className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
      Lote
    </label>
    <input
      type="text"
      className={cn(
        "rounded-xl px-3 py-2 border focus:outline-none focus:ring uppercase",
        isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
      )}
      placeholder="Ej: A23X7"
      value={costosIngresados[p.id]?.lote ?? ""}
      onChange={(e) => {
        setCostosIngresados((prev) => ({
          ...prev,
          [p.id]: { ...(prev[p.id] || {}), lote: e.target.value.trim().toUpperCase() }
        }));
      }}
    />
  </div>

  {/* Fecha de vencimiento */}
  <div className={cn("flex flex-col gap-1")}>
    <label className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
      Vencimiento
    </label>
    <input
      type="date"
      className={cn(
        "rounded-xl px-3 py-2 border focus:outline-none focus:ring",
        isDark ? "bg-slate-900/60 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
      )}
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
                        </div>

                        {/* 21.7. Panel de resultados por caja */}
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

                        {/* 21.8. Panel de resultados unitarios */}
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

                      {/* 21.9. Panel de acciones para cada producto */}
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

              {/* 21.10. Mensaje de estado cuando no hay resultados */}
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
{/* ═══════════════════════════════════════════════════════════════════════════════
            // 22. SECCIÓN DE HISTORIAL CON DRAG & DROP
            // ═══════════════════════════════════════════════════════════════════════════════ */}
            <Card className={cardClass}>
              <CardHeader className="pb-3">
                <CardTitle className={cn("text-xl font-bold flex items-center gap-3 flex-wrap", isDark ? "text-slate-100" : "text-slate-800")}>
                  📊 Historial de transacciones
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-bold",
                      isDark ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-200" : "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700"
                    )}
                  >
                    {bitacora.length} registros (local)
                  </span>

                  {/* Indicador de decisiones cargadas */}
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-bold",
                      isDark ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-200" : "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700"
                    )}
                  >
                    {loadingDecisiones ? "Cargando decisiones…" : `${decisionesHistorial.length} decisiones (Supabase)`}
                  </span>
                </CardTitle>

                {/* 22.0 Toolbar de acciones */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={cargarDecisionesDeSesion}
                    className={cn(
                      "rounded-xl",
                      isDark ? "bg-emerald-600/80 hover:bg-emerald-600 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                    title="Traer decisiones desde Supabase"
                  >
                    🔄 Recargar decisiones
                  </Button>

                  <Button
                    onClick={() => exportBitacora(bitacora)}
                    disabled={bitacora.length === 0}
                    className={cn(
                      "rounded-xl",
                      bitacora.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : isDark ? "bg-blue-600/80 hover:bg-blue-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                    title="Exportar historial local a Excel"
                  >
                    📥 Exportar historial (local)
                  </Button>

                  <Button
                    onClick={exportarDecisionesExcel}
                    disabled={decisionesHistorial.length === 0}
                    className={cn(
                      "rounded-xl",
                      decisionesHistorial.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : isDark ? "bg-purple-600/80 hover:bg-purple-600 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"
                    )}
                    title="Exportar decisiones desde Supabase"
                  >
                    📤 Exportar decisiones (Supabase)
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* 22.A — LISTA LOCAL (bitacora) con Drag & Drop */}
                {bitacora.length === 0 ? (
                  <div className={cn("text-center py-10", isDark ? "text-slate-300" : "text-slate-600")}>
                    <div className="text-6xl mb-3">📝</div>
                    <div className="text-lg font-semibold">Historial local vacío</div>
                    <div className="text-sm opacity-90">Valida y registra productos para verlos aquí.</div>
                  </div>
                ) : (
                  <div>
                    {/* 22.0. Barra de DESHACER eliminación */}
                    {undo && !undo.committed && (
                      <div
                        className={cn(
                          "mb-4 p-3 rounded-xl border-2 flex items-center justify-between gap-3",
                          isDark ? "bg-amber-500/15 border-amber-400/40 text-amber-100" : "bg-amber-50 border-amber-300 text-amber-800"
                        )}
                      >
                        <div className="text-sm font-semibold">
                          Registro eliminado. <span className="opacity-80">Tienes 5s para deshacer.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              "rounded-lg px-3 py-1",
                              isDark ? "bg-white/10 border-white/20 text-white hover:bg-white/20" : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                            )}
                            onClick={() => {
                              // Restaurar en la posición original (si existe), o al final si cambió el orden
                              setBitacora((curr) => {
                                const arr = Array.from(curr);
                                const pos = Math.min(undo.index, arr.length);
                                arr.splice(pos, 0, undo.record);
                                return arr;
                              });
                              cancelarUndo();
                            }}
                          >
                            ↩️ Deshacer
                          </Button>
                          <Button
                            size="sm"
                            className={cn(
                              "rounded-lg px-3 py-1",
                              isDark ? "bg-red-600/80 hover:bg-red-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                            )}
                            onClick={async () => {
                              // Forzar commit inmediato si tiene id
                              try {
                                await commitDeleteToSupabase(undo.record?.id);
                                await actualizarContadorSesionDespuesDeEliminar((bitacora?.length ?? 0) + 1);
                              } catch (e) {
                                console.error(e);
                              }
                              cancelarUndo();
                            }}
                          >
                            🗑️ Borrar ya
                          </Button>
                        </div>
                      </div>
                    )}

                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="historial">
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={cn("space-y-4 transition-colors duration-200", snapshot.isDraggingOver && (isDark ? "bg-white/5" : "bg-slate-50"))}
                          >
                            {/* 22.1. Items arrastrables */}
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
                                    {/* 22.2. Drag handle + borrar */}
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
                                        className={cn(
                                          "h-8 w-8 p-0 rounded-lg opacity-70 hover:opacity-100 text-red-500 hover:text-red-400",
                                          isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"
                                        )}
                                        onClick={() => eliminarRegistro(index, r)}
                                        title="Eliminar registro"
                                      >
                                        🗑️
                                      </Button>
                                    </div>

                                    {/* 22.3. Encabezado del item local */}
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

                                    {/* 22.4. Métricas del item local */}
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
                                        <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/30" : "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200")}>
                                          <div className="text-xs opacity-80 mb-1">Precio Final</div>
                                          <div className="font-bold tabular-nums text-xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-600">
                                            Bs {nf.format(r.precio ?? r["precio final"] ?? r.precio_final_caja ?? 0)}
                                          </div>
                                        </div>
                                        <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30" : "bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200")}>
                                          <div className="text-xs opacity-80 mb-1">💊 Precio Unit.</div>
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
                  </div>
                )}

                {/* 22.B — LISTA DE DECISIONES (SUPABASE) */}
                <div className={cn("mt-2 p-4 rounded-2xl border-2", isDark ? "bg-white/5 border-white/15" : "bg-white border-slate-200")}>
                  <div className="text-base font-bold mb-3 flex items-center gap-2">
                    🗂️ Decisiones guardadas (Supabase)
                    <span className={cn("text-xs px-2 py-1 rounded-lg", isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")}>
                      {loadingDecisiones ? "Cargando…" : `${decisionesHistorial.length} ítems`}
                    </span>
                  </div>

                  {loadingDecisiones ? (
                    <div className={cn("py-6 text-center", isDark ? "text-slate-300" : "text-slate-600")}>Cargando decisiones…</div>
                  ) : decisionesHistorial.length === 0 ? (
                    <div className={cn("py-6 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                      Aún no hay decisiones guardadas para esta sesión.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {decisionesHistorial.map((d, i) => (
                        <div
                          key={d.id || `dec-${i}`}
                          className={cn(
                            "p-4 rounded-2xl border-2",
                            isDark ? "bg-gradient-to-br from-white/10 to-white/5 border-white/20" : "bg-gradient-to-br from-white to-slate-50/80 border-slate-300"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-base">{d.producto || "-"}</div>
                              <div className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-500")}>
                                🏢 {d.proveedor || "-"} · 🏷️ {d.linea || "-"} · 📊 {d.codigo_barras || d.cod_ref || "-"}
                              </div>
                              <div className={cn("text-xs mt-1", isDark ? "text-slate-500" : "text-slate-600")}>
                                📅 {d.fecha ? new Date(d.fecha).toLocaleString() : "-"} · 👤 {d.usuario || "—"}
                              </div>
                            </div>
                            <span
                              className={cn(
                                "text-xs px-2 py-1 rounded-lg font-semibold",
                                (d.tipo || "").toLowerCase() === "aprobado" ? (isDark ? "bg-emerald-500/20" : "bg-emerald-100")
                                : (d.tipo || "").toLowerCase() === "rechazado" ? (isDark ? "bg-rose-500/20" : "bg-rose-100")
                                : (isDark ? "bg-amber-500/20" : "bg-amber-100")
                              )}
                            >
                              {(d.tipo || "-").toUpperCase()}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                            <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-blue-500/20" : "bg-blue-50")}>
                              <div className="text-xs opacity-80 mb-1">Precio calculado</div>
                              <div className="font-bold">
                                Bs {nf.format(d.precio_calculado ?? d.precio_final_caja ?? d["precio final"] ?? 0)}
                              </div>
                            </div>
                            <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-slate-500/20" : "bg-slate-50")}>
                              <div className="text-xs opacity-80 mb-1">Precio sistema</div>
                              <div className="font-bold">{d.precio_sistema != null ? `Bs ${nf.format(d.precio_sistema)}` : "—"}</div>
                            </div>
                            <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-amber-500/20" : "bg-amber-50")}>
                              <div className="text-xs opacity-80 mb-1">Precio sugerido</div>
                              <div className="font-bold">{d.precio_sugerido ? `Bs ${nf.format(d.precio_sugerido)}` : "—"}</div>
                            </div>
                            <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-indigo-500/20" : "bg-indigo-50")}>
                              <div className="text-xs opacity-80 mb-1">Motivo</div>
                              <div className="font-medium truncate" title={d.motivo || ""}>{d.motivo || "—"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════════════════════════
            // 23. PIE DE PÁGINA DEL MÓDULO DE MÁRGENES
            // ═══════════════════════════════════════════════════════════════════════════════ */}
            <footer className={cn("text-center py-8 space-y-2", isDark ? "text-slate-300" : "text-slate-600")}>
              <div className="text-2xl">💊</div>
              <div className="text-sm font-semibold">FarmaClinic · Módulo de Márgenes · {new Date().getFullYear()}</div>
              <div className="text-xs opacity-75">Sistema Profesional de Gestión de Precios Farmacéuticos</div>
            </footer>
          </div>
        )}:shadow-lg"
                                        : "bg-gradient-to-br from-white to-slate-50/80 border-slate-300 hover:scale-[1.02] hover
                                          {/* ═══════════════════════════════════════════════════════════════════════════════
        // 24. VISTA DEL MÓDULO DE REVISIÓN
        // ═══════════════════════════════════════════════════════════════════════════════ */}
        {vistaActiva === "revision" && (
          <div className="relative mx-auto max-w-screen-2xl p-4 md:p-6 space-y-6">
            {/* 24.1. Encabezado del módulo de revisión */}
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

            {/* 24.2. Layout de dos columnas para revisión */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 24.3. Columna izquierda: Lista de sesiones pendientes */}
              <div className="lg:col-span-4">
                <Card className={cardClass}>
                  <CardHeader className="pb-2">
                    <CardTitle className={cn("text-lg font-bold", isDark ? "text-slate-100" : "text-slate-800")}>
                      📦 Sesiones pendientes ({sesionesPendientes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sesionesPendientes.length === 0 && (
                      <div className={cn("text-sm py-8 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                        No hay sesiones para revisar.
                      </div>
                    )}
                    <div className="space-y-2">
                      {sesionesPendientes.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => abrirSesionParaRevision(s)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border-2 transition-all duration-200",
                            sesionEnRevision?.id === s.id
                              ? (isDark
                                  ? "bg-emerald-500/20 border-emerald-400/40"
                                  : "bg-emerald-50 border-emerald-300")
                              : (isDark
                                  ? "bg-white/5 border-white/15 hover:bg-white/10"
                                  : "bg-white border-slate-200 hover:bg-slate-50")
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{s.nombre}</div>
                              <div className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                                Finalizada: {s.fecha_finalizacion ? new Date(s.fecha_finalizacion).toLocaleString() : "-"}
                              </div>
                            </div>
                            <div className={cn(
                              "text-xs px-2 py-1 rounded-lg",
                              isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"
                            )}>
                              {s.total_productos ?? 0} ítems
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 24.4. Columna derecha: Detalle de la sesión seleccionada */}
              <div className="lg:col-span-8">
                {!sesionEnRevision ? (
                  <Card className={cardClass}>
                    <CardContent className={cn("py-12 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                      <div className="text-6xl mb-4">👈</div>
                      Selecciona una sesión para revisar.
                    </CardContent>
                  </Card>
                ) : (
                  <Card className={cardClass}>
                    {/* 24.5. Encabezado del detalle de sesión (con Guardar todo) */}
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className={cn("text-lg font-bold", isDark ? "text-slate-100" : "text-slate-800")}>
                          Sesión: {sesionEnRevision.nombre}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className={cn(
                              "rounded-xl",
                              isDark ? "bg-white/10 border-white/20 text-slate-100" : "bg-white border-slate-300 text-slate-800"
                            )}
                            onClick={guardarTodasLasDecisiones}
                            title="Guardar todas las decisiones de esta sesión"
                          >
                            💾 Guardar todo
                          </Button>
                          <Button
                            variant="outline"
                            className={cn(
                              "rounded-xl",
                              isDark ? "bg-white/10 border-white/20 text-slate-100" : "bg-white border-slate-300 text-slate-800"
                            )}
                            onClick={finalizarRevisionActual}
                            title="Marcar esta sesión como revisada"
                          >
                            ✅ Finalizar revisión
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {productosRevision.length === 0 ? (
                        <div className={cn("py-12 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                          Cargando líneas…
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {productosRevision.map((r) => {
                            // 24.8. Comparación, badges y controles
                            const code = r.codigo_barras || r.cod_ref;
                            const ps = preciosSistema[code];
                            const precioCalc = r.precio_final_caja ?? r["precio final"] ?? 0;
                            const precioOficial = ps?.precio_caja ?? null;
                            const d = precioOficial != null ? diffPct(precioCalc, precioOficial) : null;

                            const badge =
                              d == null
                                ? { text: "s/ referencia", cls: isDark ? "bg-white/10" : "bg-slate-100" }
                                : d > 0.5
                                ? { text: `▲ ${d.toFixed(2)}%`, cls: isDark ? "bg-emerald-500/20" : "bg-emerald-100" }
                                : d < -0.5
                                ? { text: `▼ ${d.toFixed(2)}%`, cls: isDark ? "bg-rose-500/20" : "bg-rose-100" }
                                : { text: `= ${d.toFixed(2)}%`, cls: isDark ? "bg-amber-500/20" : "bg-amber-100" };

                            const dec = decisiones[r.id] || {};

                            return (
                              <div
                                key={r.id}
                                className={cn(
                                  "p-4 rounded-2xl border-2",
                                  isDark ? "bg-white/5 border-white/15" : "bg-white border-slate-200"
                                )}
                              >
                                {/* Encabezado del item */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-base">{r.producto}</div>
                                    <div className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-500")}>
                                      🏢 {r.proveedor || "-"} · 🏷️ {r.linea || "-"} · 📊 {r.codigo_barras || r.cod_ref || "-"}
                                    </div>
                                  </div>
                                  <span className={cn("text-xs px-2 py-1 rounded-lg font-semibold", badge.cls)}>
                                    {badge.text}
                                  </span>
                                </div>

                                {/* 24.8. Grid de comparación y edición */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                  <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-blue-500/20" : "bg-blue-50")}>
                                    <div className="text-xs opacity-80 mb-1">Precio calculado</div>
                                    <div className="font-bold">Bs {nf.format(precioCalc)}</div>
                                  </div>
                                  <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-slate-500/20" : "bg-slate-50")}>
                                    <div className="text-xs opacity-80 mb-1">Precio sistema</div>
                                    <div className="font-bold">
                                      {precioOficial != null ? `Bs ${nf.format(precioOficial)}` : "—"}
                                    </div>
                                  </div>
                                  <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-amber-500/20" : "bg-amber-50")}>
                                    <div className="text-xs opacity-80 mb-1">Decisión</div>
                                    <Select
                                      value={dec.tipo || ""}
                                      onValueChange={(v) => setDecision(r.id, { tipo: v })}
                                    >
                                      <SelectTrigger className="h-9 rounded-xl">
                                        <SelectValue placeholder="Selecciona…" />
                                      </SelectTrigger>
                                      <SelectContent className={isDark ? "bg-slate-900 text-slate-100" : ""}>
                                        <SelectItem value="aprobado">Aprobar</SelectItem>
                                        <SelectItem value="rechazado">Rechazar</SelectItem>
                                        <SelectItem value="ajustar">Ajustar</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className={cn("px-3 py-2 rounded-xl", isDark ? "bg-emerald-500/20" : "bg-emerald-50")}>
                                    <div className="text-xs opacity-80 mb-1">Precio sugerido</div>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className={cn(
                                        "w-full h-9 px-3 rounded-xl bg-transparent border",
                                        isDark ? "border-white/20" : "border-slate-300"
                                      )}
                                      onChange={(e) => setDecision(r.id, { precio_sugerido: e.target.value })}
                                      value={dec.precio_sugerido || ""}
                                      placeholder="Bs 0.00"
                                    />
                                  </div>
                                </div>

                                {/* 24.9. Campo de comentarios y guardado individual */}
                                <div className="mt-3 flex flex-col md:flex-row gap-3">
                                  <input
                                    type="text"
                                    className={cn(
                                      "flex-1 h-9 px-3 rounded-xl bg-transparent border",
                                      isDark ? "border-white/20" : "border-slate-300"
                                    )}
                                    placeholder="Motivo / comentario (opcional)…"
                                    value={dec.motivo || ""}
                                    onChange={(e) => setDecision(r.id, { motivo: e.target.value })}
                                  />
                                  <Button
                                    size="sm"
                                    className={cn(
                                      "px-4 rounded-xl font-semibold",
                                      isDark
                                        ? "bg-emerald-600/80 hover:bg-emerald-600 text-white"
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    )}
                                    onClick={() => guardarDecisionLinea(r)}
                                    title="Guardar solo esta decisión"
                                  >
                                    💾 Guardar
                                  </Button>
                                </div>
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

        {/* ═══════════════════════════════════════════════════════════════════════════════
        // 25. VISTA DEL MÓDULO DE HISTORIAL
        // ═══════════════════════════════════════════════════════════════════════════════ */}
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

            <Card className={cardClass}>
              <CardContent className={cn("py-12 text-center", isDark ? "text-slate-300" : "text-slate-600")}>
                <div className="text-6xl mb-4">🚧</div>
                <div className="text-xl font-semibold mb-2">Módulo en desarrollo</div>
                <div className="text-base">La funcionalidad de búsqueda avanzada estará disponible próximamente</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

      



// [REMOVED duplicate function guardarTodasLasDecisiones]
