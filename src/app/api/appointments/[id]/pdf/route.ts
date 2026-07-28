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
        account_id,
        appointment_date, 
        appointment_time, 
        token_number, 
        queue_position, 
        booking_id, 
        notes, 
        department, 
        patient:contacts(id, name, phone, email, metadata), 
        doctor:hospital_doctors(id, name, specialization)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Fetch registered patient ID from patients table if available
    let patientSeqId = "PAT-000000";
    if (appt.patient?.id) {
      const { data: patRow } = await db
        .from("patients")
        .select("patient_seq_id")
        .eq("id", appt.patient.id)
        .maybeSingle();
      if (patRow?.patient_seq_id) {
        patientSeqId = patRow.patient_seq_id;
      } else if ((appt.patient as any)?.metadata?.patient_id) {
        patientSeqId = (appt.patient as any).metadata.patient_id;
      }
    }

    // Fetch business/hospital name from account
    let hospitalName = "AI CLINICAL CENTER";
    if (appt.account_id) {
      const { data: acc } = await db
        .from("accounts")
        .select("name")
        .eq("id", appt.account_id)
        .maybeSingle();
      if (acc?.name) {
        hospitalName = acc.name;
      }
    }

    const patient = appt.patient as any;
    const doctor = appt.doctor as any;
    const bookingId = appt.booking_id || `APT-2026-${id.slice(0, 5).toUpperCase()}`;
    const tokenNum = appt.token_number || 1;
    const queuePos = appt.queue_position || 1;

    // Generate Ticket Serial Number (daily count for this account on appointment date)
    const { count: dailyCount } = await db
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', appt.account_id)
      .eq('appointment_date', appt.appointment_date)
      .lte('created_at', appt.created_at || new Date().toISOString());
    const ticketSerial = `TKT-${String(dailyCount || 1).padStart(3, '0')}`;

    // Initialize PDF (A4 Portrait)
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // =========================================================================
    // WATERMARK: Business / Hospital Name in Background (Angled 45 deg)
    // =========================================================================
    try {
      doc.saveGraphicsState();
      doc.setTextColor(225, 231, 239); // Light slate/cyan watermark tone
      doc.setFont("helvetica", "bold");
      const watermarkSize = hospitalName.length > 25 ? 24 : 32;
      doc.setFontSize(watermarkSize);
      // Position watermark text right across the center of the page at 45 degree angle
      doc.text(hospitalName.toUpperCase(), 105, 145, {
        align: "center",
        angle: 45,
      });
      doc.restoreGraphicsState();
    } catch (wmErr) {
      console.warn("Watermark render fallback:", wmErr);
    }

    // =========================================================================
    // 1. Top Header Banner
    // =========================================================================
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 42, "F");

    // Hospital / Business Name Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    const titleSize = hospitalName.length > 22 ? 16 : 20;
    doc.setFontSize(titleSize);
    doc.text(hospitalName.toUpperCase(), 15, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text("OFFICIAL OPD CONSULTATION TICKET & QUEUE TOKEN SLIP", 15, 26);
    doc.text("WhatsApp Helpline & Digital Reception Desk", 15, 32);

    // Green Decorative Accent Stripe
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 42, 210, 2.5, "F");

    // =========================================================================
    // 2. Booking Reference Bar
    // =========================================================================
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(15, 52, 180, 22, "F");

    doc.setTextColor(51, 65, 85); // Slate 700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`BOOKING REF: ${bookingId}`, 20, 60);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`TICKET SERIAL: ${ticketSerial}   |   ISSUED: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 20, 67);
    
    // Status Badge (CONFIRMED)
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(142, 56, 45, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("CONFIRMED", 150, 62);

    // =========================================================================
    // 3. TICKET / TOKEN NUMBER SPOTLIGHT CARD (Main Feature)
    // =========================================================================
    doc.setFillColor(236, 253, 245); // Emerald 50
    doc.setDrawColor(167, 243, 208); // Emerald 200
    doc.rect(15, 82, 180, 46, "FD");

    doc.setTextColor(6, 95, 70); // Emerald 800
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("YOUR OPD CONSULTATION TICKET NUMBER", 25, 93);

    // GIANT TICKET TOKEN NUMBER DISPLAY
    doc.setFontSize(40);
    doc.setTextColor(5, 150, 105); // Emerald 600
    doc.text(`TOKEN #${tokenNum}`, 25, 117);

    // Queue Position Information
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`Queue Position: #${queuePos}`, 110, 98);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Patient ID: ${patientSeqId}`, 110, 105);
    doc.text("Status: Verified Active Ticket", 110, 112);
    doc.text("Est. Waiting Time: ~10-15 mins", 110, 119);

    // =========================================================================
    // 4. Patient & Doctor Consultation Grids
    // =========================================================================
    // Left Box: Patient Info
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 136, 86, 52, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PATIENT DETAILS", 22, 145);
    doc.line(22, 147, 93, 147);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Name: ${patient?.name || "Unknown Patient"}`, 22, 156);
    doc.text(`Patient ID: ${patientSeqId}`, 22, 163);
    doc.text(`Mobile: ${patient?.phone || "N/A"}`, 22, 170);
    doc.text(`Email: ${patient?.email || "N/A"}`, 22, 177);

    // Right Box: Doctor & Consultation Details
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(109, 136, 86, 52, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CONSULTATION DETAILS", 116, 145);
    doc.line(116, 147, 187, 147);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const doctorName = doctor?.name ? (doctor.name.startsWith("Dr.") ? doctor.name : `Dr. ${doctor.name}`) : "On-Duty Consultant";
    doc.text(`Doctor: ${doctorName}`, 116, 156);
    doc.text(`Department: ${appt.department || "General OPD"}`, 116, 163);
    doc.text(`Date: ${appt.appointment_date}`, 116, 170);
    doc.text(`Time Slot: ${appt.appointment_time}`, 116, 177);

    // =========================================================================
    // 5. Instruction Guidelines Box
    // =========================================================================
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(252, 211, 77); // Amber 300
    doc.rect(15, 196, 180, 24, "FD");
    
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(`IMPORTANT ${hospitalName.toUpperCase()} RECEPTION INSTRUCTIONS:`, 22, 203);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("• Please arrive at reception at least 15 minutes before your scheduled appointment slot.", 22, 209);
    doc.text("• Show this Digital OPD Ticket Slip PDF or your Ticket Token # on your mobile to the token desk.", 22, 214);

    // =========================================================================
    // 6. QR Code Verification Section
    // =========================================================================
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8.5);
    doc.text("Scan QR code to verify OPD ticket authenticity", 115, 262);

    const qrDataUrl = await QRCode.toDataURL(`OPD-TICKET:${bookingId}|PAT:${patientSeqId}|TOKEN:${tokenNum}`);
    doc.addImage(qrDataUrl, "PNG", 132, 224, 34, 34);

    // =========================================================================
    // 7. Footer & Security Stamp
    // =========================================================================
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 272, 195, 272);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Watermark verified: ${hospitalName} • Official Digital Consultation Ticket Slip`, 15, 278);
    doc.text(`Powered by WACRM AI Hospital Assistant`, 155, 278);

    const pdfOutput = doc.output("arraybuffer");

    return new NextResponse(pdfOutput, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="opd-ticket-${bookingId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF ticket generation failed:", err);
    return NextResponse.json({ error: "Failed to generate PDF ticket: " + err.message }, { status: 500 });
  }
}
