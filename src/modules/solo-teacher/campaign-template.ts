import { CampaignTemplateItem } from '../types';

export const campaignTemplateConfig: CampaignTemplateItem[] = [
  {
    name: 'Admission Open',
    category: 'Enrollment',
    messageBody: 'Hello {{StudentName}}, admissions are now open for our {{CourseName}} batch starting {{BatchDate}}! Limited seats available. Enroll now to secure your spot. 📚',
    ctaType: 'url',
    ctaText: 'Enroll Now',
    ctaUrl: ''
  },
  {
    name: 'New Batch Announcement',
    category: 'Enrollment',
    messageBody: 'Hi {{StudentName}}, a new batch for {{CourseName}} is starting on {{BatchDate}}! 🎓 Timings: {{BatchTime}}. Register today!',
    ctaType: 'none'
  },
  {
    name: 'Exam Reminder',
    category: 'Academic',
    messageBody: 'Reminder: {{StudentName}}, your exam for {{CourseName}} is scheduled on {{ExamDate}} at {{ExamTime}}. Good luck! 📝',
    ctaType: 'none'
  },
  {
    name: 'Assignment Reminder',
    category: 'Academic',
    messageBody: 'Hi {{StudentName}}, please submit your {{AssignmentName}} assignment by {{Deadline}}. Let me know if you need help! ✍️',
    ctaType: 'none'
  },
  {
    name: 'Holiday Notice',
    category: 'General',
    messageBody: 'Dear {{StudentName}}, please note that classes will be closed on {{Date}} for {{Reason}}. Regular classes resume on {{ResumeDate}}. 🏖️',
    ctaType: 'none'
  },
  {
    name: 'Class Cancellation',
    category: 'General',
    messageBody: "Hi {{StudentName}}, today's class for {{CourseName}} has been cancelled due to {{Reason}}. It will be rescheduled to {{NewDate}}. Sorry for the inconvenience! 🙏",
    ctaType: 'none'
  },
  {
    name: 'Course Completion',
    category: 'Academic',
    messageBody: 'Congratulations {{StudentName}}! 🎉 You have successfully completed the {{CourseName}} course. Your certificate is ready for download.',
    ctaType: 'url',
    ctaText: 'Download Certificate',
    ctaUrl: ''
  },
  {
    name: 'Certificate Ready',
    category: 'Academic',
    messageBody: 'Hi {{StudentName}}, your course completion certificate for {{CourseName}} is ready! 🏆 Download it from your student dashboard.',
    ctaType: 'url',
    ctaText: 'View Certificate',
    ctaUrl: ''
  },
];
