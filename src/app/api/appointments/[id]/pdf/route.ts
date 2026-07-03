import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Create supabase admin/service client to bypass RLS for PDF generation
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const { createClient: createSupabase } = require("@supabase/supabase-js");
  const db = createSupabase(supabaseUrl, supabaseKey);

  try {
    const { data: appt, error } = await db
      .from("appointments")
      .select(`
        id, 
        appointment_date, 
        appointment_time, 
        token_number, 
        queue_position, 
        booking_id, 
        notes, 
        department, 
        patient:contacts(id, name, phone, email), 
        doctor:hospital_doctors(id, name, specialization)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const patient = appt.patient as any;
    const doctor = appt.doctor as any;
    const bookingId = appt.booking_id || `APT-2026-${id.slice(0, 5).toUpperCase()}`;
    const tokenNum = appt.token_number || 1;
    const queuePos = appt.queue_position || 1;

    // Initialize PDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // 1. Accent Header Banner
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 210, 40, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("AI CLINICAL CENTER", 15, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Automated Patient Care & Token Confirmation System", 15, 25);
    doc.text("Emergency Hotline: +1 (555) 0199 | care@clinic.ai", 15, 30);

    // 2. Booking Header Box
    doc.setFillColor(243, 244, 246); // Gray 100
    doc.rect(15, 48, 180, 22, "F");

    doc.setTextColor(55, 65, 81); // Gray 700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`BOOKING ID: ${bookingId}`, 20, 56);
    doc.text(`CONFIRMATION DATE: ${new Date().toLocaleDateString()}`, 20, 62);
    
    // Status Badge
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(140, 52, 45, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text("CONFIRMED", 148, 57.5);

    // 3. Token details (Main Spotlight Card)
    doc.setFillColor(239, 246, 255); // Blue 50
    doc.setDrawColor(191, 219, 254); // Blue 200
    doc.rect(15, 78, 180, 42, "FD");

    doc.setTextColor(30, 58, 138); // Blue 900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DIGITAL QUEUE TOKEN", 25, 88);

    doc.setFontSize(36);
    doc.text(`#${tokenNum}`, 25, 110);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Queue Position: ${queuePos}`, 85, 95);
    doc.text("Est. Waiting Time: ~15 mins", 85, 102);
    doc.text("Status: Active in Queue", 85, 109);

    // 4. Patient & Doctor Grids
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("PATIENT INFORMATION", 15, 135);
    doc.line(15, 137, 95, 137);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Name: ${patient?.name || "Unknown"}`, 15, 144);
    doc.text(`Phone: ${patient?.phone || "N/A"}`, 15, 150);
    doc.text(`Email: ${patient?.email || "N/A"}`, 15, 156);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("CONSULTATION DETAILS", 115, 135);
    doc.line(115, 137, 195, 137);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Doctor: ${doctor?.name || "On-Duty Physician"}`, 115, 144);
    doc.text(`Department: ${appt.department || "General"}`, 115, 150);
    doc.text(`Date: ${appt.appointment_date}`, 115, 156);
    doc.text(`Time Slot: ${appt.appointment_time}`, 115, 162);

    // 5. Instruction Guidelines
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.rect(15, 178, 180, 20, "F");
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("IMPORTANT CLINIC GUIDELINES:", 20, 184);
    doc.setFont("helvetica", "normal");
    doc.text("- Please arrive at the reception desk 15 minutes prior to your scheduled consultation slot.", 20, 189);
    doc.text("- Present this Digital Token PDF or your Booking ID on WhatsApp to collect your physical card.", 20, 194);

    // 6. QR Code Section
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text("Scan QR to verify booking status", 125, 260);

    const qrDataUrl = await QRCode.toDataURL(`APT:${bookingId}`);
    doc.addImage(qrDataUrl, "PNG", 135, 215, 40, 40);

    // 7. Footer brand
    doc.setFontSize(8);
    doc.text("Generated automatically by AI Clinical Assistant. Security verification valid.", 15, 280);

    const pdfOutput = doc.output("arraybuffer");

    return new NextResponse(pdfOutput, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="appointment-${bookingId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    return NextResponse.json({ error: "Failed to generate PDF: " + err.message }, { status: 500 });
  }
}
