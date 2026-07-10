import { KbTemplateItem } from '../types';

export const knowledgeTemplateConfig: KbTemplateItem[] = [
  {
    category: 'service',
    questionTitle: 'Available Courses',
    answerContent: 'We offer courses in [Subject]. Each course covers [Topics]. Duration: [Duration]. Mode: Online / Offline.'
  },
  {
    category: 'pricing',
    questionTitle: 'Course Fees',
    answerContent: 'Our course fees range from ₹[Amount] to ₹[Amount]. We offer installment options and early-bird discounts.'
  },
  {
    category: 'faq',
    questionTitle: 'Batch Timings',
    answerContent: 'Morning Batch: [Time]. Evening Batch: [Time]. Weekend Batch: [Time]. Classes are [Duration] long.'
  },
  {
    category: 'faq',
    questionTitle: 'Class Schedule',
    answerContent: 'Classes run [Days]. Each session is [Duration]. Schedule is shared after enrollment confirmation.'
  },
  {
    category: 'faq',
    questionTitle: 'Enrollment Process',
    answerContent: 'Step 1: Choose your course. Step 2: Select a batch. Step 3: Complete payment. Step 4: Receive joining confirmation.'
  },
  {
    category: 'policy',
    questionTitle: 'Refund & Cancellation',
    answerContent: 'Full refund if cancelled within 7 days of enrollment. 50% refund within 14 days. No refund after 14 days.'
  },
  {
    category: 'faq',
    questionTitle: 'Certificates',
    answerContent: 'Yes, a completion certificate is provided after finishing the course and passing the final assessment.'
  },
  {
    category: 'company',
    questionTitle: 'Contact Information',
    answerContent: 'You can reach the teacher at [Phone] or [Email]. Available [Days] from [Time] to [Time].'
  },
];
