"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Users, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string;
  name: string;
  code: string;
  duration: string;
  shifts: string;
  capacity: number;
}

const DEFAULT_COURSES: Course[] = [
  { id: "1", name: "High School Physics Batch", code: "PHY-101", duration: "6 Months", shifts: "Morning (08:00 - 10:00)", capacity: 30 },
  { id: "2", name: "Advanced Mathematics Prep", code: "MAT-202", duration: "12 Months", shifts: "Evening (17:00 - 19:00)", capacity: 25 },
  { id: "3", name: "SAT/ACT Prep Crash Course", code: "SAT-505", duration: "3 Months", shifts: "Weekend Batch", capacity: 40 },
];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [duration, setDuration] = useState("");
  const [shifts, setShifts] = useState("");
  const [capacity, setCapacity] = useState("");

  useEffect(() => {
    // Load local storage or mock items
    const saved = localStorage.getItem("coaching_courses");
    if (saved) {
      setCourses(JSON.parse(saved));
    } else {
      setCourses(DEFAULT_COURSES);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      toast.error("Please fill in required fields.");
      return;
    }

    const newCourse: Course = {
      id: Date.now().toString(),
      name,
      code,
      duration: duration || "6 Months",
      shifts: shifts || "Morning",
      capacity: parseInt(capacity) || 30,
    };

    const updated = [newCourse, ...courses];
    setCourses(updated);
    localStorage.setItem("coaching_courses", JSON.stringify(updated));
    toast.success("Batch course created successfully!");
    setName("");
    setCode("");
    setDuration("");
    setShifts("");
    setCapacity("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coaching Batch Courses</h1>
          <p className="text-sm text-muted-foreground">Manage active lectures, courses, and capacity bounds.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> Add Course
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="font-bold text-foreground">Create New Course Batch</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Course Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chemistry Entrance Batch" required />
            </div>
            <div className="space-y-2">
              <Label>Course Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CHE-303" required />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 6 Months" />
            </div>
            <div className="space-y-2">
              <Label>Batch Shifts / Hours</Label>
              <Input value={shifts} onChange={(e) => setShifts(e.target.value)} placeholder="e.g. Evening (16:30 - 18:30)" />
            </div>
            <div className="space-y-2">
              <Label>Seats Capacity</Label>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 30" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button type="submit">Create Course</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                {c.code}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg leading-snug">{c.name}</h3>
              <p className="text-muted-foreground text-xs flex items-center mt-2">
                <Clock className="h-4 w-4 mr-1 text-muted-foreground/70" /> {c.shifts}
              </p>
              <p className="text-muted-foreground text-xs flex items-center mt-1">
                <Users className="h-4 w-4 mr-1 text-muted-foreground/70" /> Capacity: {c.capacity} Students (Total: {c.duration})
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
