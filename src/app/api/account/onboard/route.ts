import { NextResponse } from "next/server";
import { getCurrentAccount, requireRole, toErrorResponse } from "@/lib/auth/account";

interface StageSeed {
  name: string;
  position: number;
  color: string;
}

interface KbSeed {
  category: "faq" | "service" | "pricing" | "policy" | "company";
  question_title: string;
  answer_content: string;
}

interface IndustryConfig {
  aiPrompt: string;
  modules: string[];
  pipelineStages: StageSeed[];
  kbEntries: KbSeed[];
}

const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  hospital_clinic: {
    aiPrompt: `You are acting as the AI medical receptionist for the clinic.
Guidelines:
1. **Enroll Patients with Structured Form**:
   - Whenever the customer indicates they want to book an appointment, reply with the structured patient registration form:
     📋 *PATIENT REGISTRATION FORM*
     Please reply with details: Name, Gender, DOB (YYYY-MM-DD), Blood Group, Emergency Contact.
   - Do NOT book the appointment until Name, Gender, and DOB are collected.
2. **Confirm Booking**:
   - Once details are filled, set booking action to "book" and confirm doctor/slot details clearly in reply.
3. **Emergency Alert**:
   - Intercept critical symptoms (chest pain, severe bleeding) and prompt urgent ER actions.`,
    modules: ["hospital_clinic"],
    pipelineStages: [
      { name: "New Patient", position: 1, color: "#3b82f6" },
      { name: "Triage / Pending", position: 2, color: "#f59e0b" },
      { name: "Doctor Assigned", position: 3, color: "#8b5cf6" },
      { name: "Lab Testing", position: 4, color: "#ec4899" },
      { name: "Checked Out", position: 5, color: "#10b981" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Clinic Hours", answer_content: "We are open Monday to Saturday from 8:00 AM to 8:00 PM." },
      { category: "service", question_title: "Doctors Available", answer_content: "Specialists in General Medicine, Pediatrics, Cardiology, and Orthopedics." },
      { category: "pricing", question_title: "Consultation Fee", answer_content: "General consultation starts at $50. Specialist consults start at $100." },
    ],
  },
  real_estate: {
    aiPrompt: `You are acting as the AI Real Estate Agent for our agency.
Guidelines:
1. **Qualify Buyers**:
   - Ask for full name, purchase budget, preferred location, and target bedroom/bathroom count.
2. **Recommend Properties**:
   - Search properties context and list matching options with prices.
3. **Book Site Visits**:
   - Suggest booking a site tour view with an agent.
4. **Interactive Action**:
   - Automatically present options to schedule a visit or explore properties list.`,
    modules: ["real_estate"],
    pipelineStages: [
      { name: "New Lead", position: 1, color: "#3b82f6" },
      { name: "Site Visit Scheduled", position: 2, color: "#f59e0b" },
      { name: "Offer Submitted", position: 3, color: "#8b5cf6" },
      { name: "Contract Signed", position: 4, color: "#ec4899" },
      { name: "Closed Deal", position: 5, color: "#10b981" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Purchase Documents", answer_content: "Requires pre-approval letter/proof of funds, government ID, and a 10% earnest money deposit." },
      { category: "service", question_title: "Listing Types", answer_content: "Luxury apartments, family villas, commercial plots, and townhouses." },
      { category: "pricing", question_title: "Average Commissions", answer_content: "Standard buyer agency commission is 2.5% to 3% of the sale value." },
    ],
  },
  travel: {
    aiPrompt: `You are acting as the AI Travel Consultant.
Guidelines:
1. **Qualify Travelers**:
   - Collect travel destination, preferred travel date, trip duration, and number of guests.
2. **Suggest Packages**:
   - Offer customized trip itineraries and tours packages.
3. **Confirm Travel Booking**:
   - Coordinate deposit payment details to lock travel schedules.`,
    modules: ["travel"],
    pipelineStages: [
      { name: "Inquiry Received", position: 1, color: "#3b82f6" },
      { name: "Quotation Sent", position: 2, color: "#f59e0b" },
      { name: "Deposit Paid", position: 3, color: "#8b5cf6" },
      { name: "Trip Active", position: 4, color: "#ec4899" },
      { name: "Completed", position: 5, color: "#10b981" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Refund Policy", answer_content: "Full refund up to 14 days before tour. 50% refund up to 7 days before. Non-refundable within 48 hours." },
      { category: "service", question_title: "Active Packages", answer_content: "Customized family packages, honeymoon tours, and adventure packages to Switzerland, Bali, and Dubai." },
    ],
  },
  coaching: {
    aiPrompt: `You are acting as the AI Admission Counselor for our Coaching Institute.
Guidelines:
1. **Student Intake**:
   - Collect student's current grade, target stream (Science, Math), and exams preparation (SAT/JEE/NEET).
2. **Recommend Batches**:
   - Present available batch hours and teacher assignments.
3. **Tuition Fees**:
   - Present fee structures and install options.`,
    modules: ["coaching"],
    pipelineStages: [
      { name: "Admission Lead", position: 1, color: "#3b82f6" },
      { name: "Demo Attended", position: 2, color: "#f59e0b" },
      { name: "Fee Installment Due", position: 3, color: "#8b5cf6" },
      { name: "Active Student", position: 4, color: "#10b981" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Class Timings", answer_content: "Morning: 7:00 AM - 9:00 AM. Evening: 4:30 PM - 7:30 PM. Weekend batches available." },
      { category: "service", question_title: "Courses Offered", answer_content: "Target exam coaching classes for high school maths, physics, chemistry, and biology." },
    ],
  },
  restaurant: {
    aiPrompt: `You are acting as the AI Restaurant Booking Agent.
Guidelines:
1. **Confirm Reservations**:
   - Collect guest name, size of party, booking date, and table slot.
2. **Diet Requests**:
   - Answer food menu questions and note dietary constraints.`,
    modules: ["restaurant"],
    pipelineStages: [
      { name: "Reservation Inbound", position: 1, color: "#3b82f6" },
      { name: "Table Assigned", position: 2, color: "#f59e0b" },
      { name: "Seated & Serving", position: 3, color: "#8b5cf6" },
      { name: "Completed", position: 4, color: "#10b981" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Allergy Options", answer_content: "We offer gluten-free bread/crust alternatives and dairy-free vegan cheeses. Please notify your waiter." },
      { category: "service", question_title: "Menu Specialties", answer_content: "Wood-fired specialty pizzas, seafood platters, and garlic salmon steaks." },
    ],
  },
  gym: {
    aiPrompt: `You are acting as the AI Gym Fitness Advisor.
Guidelines:
1. **Trial Sessions**:
   - Invite local prospects to schedule a free fitness trial class.
2. **Membership Info**:
   - Present pricing cards (monthly, annual, trainer passes).`,
    modules: ["gym"],
    pipelineStages: [
      { name: "Inbound Trial Lead", position: 1, color: "#3b82f6" },
      { name: "Trial Completed", position: 2, color: "#f59e0b" },
      { name: "Membership Active", position: 3, color: "#10b981" },
      { name: "Expired / Lapsed", position: 4, color: "#ef4444" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Opening Hours", answer_content: "Gym floors are open 24/7. Trainers are present on site Monday-Friday 6:00 AM - 10:00 PM." },
      { category: "service", question_title: "Class Lists", answer_content: "Strength training, Yoga, HIIT cardio circuits, and private personal training." },
    ],
  },
  ecommerce: {
    aiPrompt: `You are acting as the AI E-commerce Assistant.
Guidelines:
1. **Find Products**:
   - Help customer search listing categories and sizes.
2. **Order Status**:
   - Look up shipping tracking info using reference ID.
3. **Refunds/Returns**:
   - Guide them through standard returns windows.`,
    modules: ["ecommerce"],
    pipelineStages: [
      { name: "Order Placed", position: 1, color: "#3b82f6" },
      { name: "Processing", position: 2, color: "#f59e0b" },
      { name: "Shipped", position: 3, color: "#8b5cf6" },
      { name: "Delivered", position: 4, color: "#10b981" },
      { name: "Returned", position: 5, color: "#ef4444" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Return Limits", answer_content: "Returns are accepted within 30 days of delivery with original tags and package." },
      { category: "service", question_title: "Shipping Schedules", answer_content: "Standard delivery: 3-5 days. Express overnight delivery options are available." },
    ],
  },
  digital_agency: {
    aiPrompt: `You are acting as the AI Business Consultant for our Digital Agency.
Guidelines:
1. **Gather Client Goals**:
   - Ask about project details (website development, graphic design, ad campaigns, SEO).
2. **Consultation Call**:
   - Invite them to schedule a detailed scoping call.`,
    modules: ["digital_agency"],
    pipelineStages: [
      { name: "Lead Inbound", position: 1, color: "#3b82f6" },
      { name: "Discovery Scheduled", position: 2, color: "#f59e0b" },
      { name: "Proposal Sent", position: 3, color: "#8b5cf6" },
      { name: "Contract Won", position: 4, color: "#10b981" },
      { name: "Contract Lost", position: 5, color: "#ef4444" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Agency Timelines", answer_content: "Web development takes 4-8 weeks. Brand style updates take 3-4 weeks. Ad campaign setups take 1-2 weeks." },
      { category: "service", question_title: "Agency Services", answer_content: "Next.js web engineering, Figma designs, search engine optimization, and Meta/Google ad spend management." },
    ],
  },
  general: {
    aiPrompt: `You are acting as the AI Assistant. Assist customers with inquiries, gather details, score leads, and hand off to human agents when requested.`,
    modules: [],
    pipelineStages: [
      { name: "New Lead", position: 1, color: "#3b82f6" },
      { name: "Contacted", position: 2, color: "#f59e0b" },
      { name: "Qualified", position: 3, color: "#8b5cf6" },
      { name: "Proposal Sent", position: 4, color: "#ec4899" },
      { name: "Won", position: 5, color: "#10b981" },
      { name: "Lost", position: 6, color: "#ef4444" },
    ],
    kbEntries: [
      { category: "faq", question_title: "Company Summary", answer_content: "We provide high-quality services tailored to dynamic customer requests." },
    ],
  },
};

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json();
    const { industry, reset } = body;

    if (reset) {
      const { error: accErr } = await ctx.supabase
        .from("accounts")
        .update({
          industry: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ctx.accountId);

      if (accErr) {
        console.error("[onboard route] failed to reset industry:", accErr);
        throw accErr;
      }
      return NextResponse.json({ success: true, reset: true });
    }

    if (!industry || !INDUSTRY_CONFIGS[industry]) {
      return NextResponse.json(
        { error: "Invalid industry template choice" },
        { status: 400 }
      );
    }

    const config = INDUSTRY_CONFIGS[industry];

    // 1. Update Accounts table columns (industry, ai_system_prompt)
    const { error: accErr } = await ctx.supabase
      .from("accounts")
      .update({
        industry,
        ai_system_prompt: config.aiPrompt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.accountId);

    if (accErr) {
      console.error("[onboard route] failed to update account:", accErr);
      throw accErr;
    }

    // 2. Set up dynamic modules (disable all other modules, enable selected)
    const allKnownModules = [
      "hospital_clinic",
      "real_estate",
      "travel",
      "coaching",
      "restaurant",
      "gym",
      "ecommerce",
      "digital_agency",
    ];

    for (const mod of allKnownModules) {
      const isEnabled = config.modules.includes(mod);
      const { error: modErr } = await ctx.supabase
        .from("tenant_modules")
        .upsert(
          {
            account_id: ctx.accountId,
            module_key: mod,
            enabled: isEnabled,
            settings: {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id, module_key" }
        );

      if (modErr) {
        console.error(`[onboard route] failed to upsert module ${mod}:`, modErr);
      }
    }

    // 3. Set up primary pipeline stages
    let pipelineId: string;
    const { data: extPipes, error: getPipeErr } = await ctx.supabase
      .from("pipelines")
      .select("id")
      .eq("account_id", ctx.accountId)
      .limit(1);

    if (getPipeErr) throw getPipeErr;

    if (extPipes && extPipes.length > 0) {
      pipelineId = extPipes[0].id;
    } else {
      // Find account owner
      const { data: ownerProf } = await ctx.supabase
        .from("profiles")
        .select("user_id")
        .eq("account_id", ctx.accountId)
        .eq("account_role", "owner")
        .maybeSingle();

      const defaultUserId = ownerProf?.user_id || ctx.userId;

      const { data: newPipe, error: pipeErr } = await ctx.supabase
        .from("pipelines")
        .insert({
          account_id: ctx.accountId,
          name: "Sales Pipeline",
          user_id: defaultUserId,
        })
        .select("id")
        .single();

      if (pipeErr) {
        console.error("[onboard route] failed to create pipeline:", pipeErr);
        throw pipeErr;
      }
      pipelineId = newPipe.id;
    }

    // Clear old stages to keep it fresh
    await ctx.supabase
      .from("pipeline_stages")
      .delete()
      .eq("pipeline_id", pipelineId);

    // Insert new seeded stages
    const stagesToInsert = config.pipelineStages.map((st) => ({
      pipeline_id: pipelineId,
      name: st.name,
      position: st.position,
      color: st.color,
    }));

    const { error: stageErr } = await ctx.supabase
      .from("pipeline_stages")
      .insert(stagesToInsert);

    if (stageErr) {
      console.error("[onboard route] failed to seed stages:", stageErr);
    }

    // 4. Pre-seed Knowledge Base entries
    await ctx.supabase
      .from("knowledge_base")
      .delete()
      .eq("account_id", ctx.accountId);

    if (config.kbEntries.length > 0) {
      const kbToInsert = config.kbEntries.map((kb) => ({
        account_id: ctx.accountId,
        category: kb.category,
        question_title: kb.question_title,
        answer_content: kb.answer_content,
      }));

      const { error: kbErr } = await ctx.supabase
        .from("knowledge_base")
        .insert(kbToInsert);

      if (kbErr) {
        console.error("[onboard route] failed to seed KB:", kbErr);
      }
    }

    return NextResponse.json({ success: true, industry });
  } catch (err) {
    return toErrorResponse(err);
  }
}
