/**
 * OASF (Open Agentic Schema Framework) taxonomy data.
 * Skills and domains for agent capability classification.
 * Source: https://schema.oasf.io
 */

export interface OASFSkillCategory {
  category: string;
  skills: string[];
}

export const OASF_SKILL_CATEGORIES: OASFSkillCategory[] = [
  {
    category: "Natural Language Processing",
    skills: [
      "Text Generation",
      "Text Summarization",
      "Text Classification",
      "Sentiment Analysis",
      "Named Entity Recognition",
      "Machine Translation",
      "Question Answering",
      "Conversational AI",
      "Text Embedding",
      "Semantic Search",
    ],
  },
  {
    category: "Reasoning & Planning",
    skills: [
      "Long-Horizon Reasoning",
      "Strategic Planning",
      "Logical Deduction",
      "Causal Reasoning",
      "Multi-Step Problem Solving",
      "Decision Making",
      "Goal Decomposition",
      "Constraint Satisfaction",
    ],
  },
  {
    category: "Code & Development",
    skills: [
      "Code Generation",
      "Code Review",
      "Code Debugging",
      "Code Refactoring",
      "Test Generation",
      "Documentation Generation",
      "API Integration",
      "Database Query Generation",
    ],
  },
  {
    category: "Data & Analytics",
    skills: [
      "Data Analysis",
      "Data Visualization",
      "Statistical Modeling",
      "Anomaly Detection",
      "Forecasting",
      "Report Generation",
      "ETL Processing",
      "Data Cleaning",
    ],
  },
  {
    category: "Computer Vision",
    skills: [
      "Image Classification",
      "Object Detection",
      "Image Segmentation",
      "OCR",
      "Image Generation",
      "Video Analysis",
      "Face Recognition",
      "Scene Understanding",
    ],
  },
  {
    category: "Audio & Speech",
    skills: [
      "Speech-to-Text",
      "Text-to-Speech",
      "Audio Classification",
      "Music Generation",
      "Voice Cloning",
      "Speaker Identification",
    ],
  },
  {
    category: "Knowledge & Research",
    skills: [
      "Information Retrieval",
      "Fact Checking",
      "Knowledge Graph Navigation",
      "Literature Review",
      "Citation Analysis",
      "Trend Analysis",
    ],
  },
  {
    category: "Automation & Integration",
    skills: [
      "Workflow Automation",
      "Web Scraping",
      "Email Automation",
      "Calendar Management",
      "File Management",
      "Notification Handling",
      "Task Scheduling",
    ],
  },
  {
    category: "Security & Compliance",
    skills: [
      "Vulnerability Scanning",
      "Threat Detection",
      "Access Control",
      "Compliance Checking",
      "Audit Logging",
      "Data Encryption",
    ],
  },
  {
    category: "Creative & Design",
    skills: [
      "Content Writing",
      "Copywriting",
      "UI/UX Suggestions",
      "Brand Voice Matching",
      "Storyboarding",
      "Design System Generation",
    ],
  },
];

export const OASF_DOMAINS: string[] = [
  // Technology
  "Artificial Intelligence",
  "Machine Learning",
  "Cloud Computing",
  "Cybersecurity",
  "DevOps",
  "Blockchain",
  "IoT",
  "Edge Computing",
  "Quantum Computing",
  // Business
  "E-Commerce",
  "FinTech",
  "InsurTech",
  "Supply Chain",
  "Customer Service",
  "Marketing",
  "Sales",
  "Human Resources",
  "Legal",
  // Science & Engineering
  "Bioinformatics",
  "Drug Discovery",
  "Materials Science",
  "Robotics",
  "Autonomous Vehicles",
  "Aerospace",
  // Healthcare
  "Medical Diagnosis",
  "Clinical Trials",
  "Health Monitoring",
  "Telemedicine",
  "Mental Health",
  // Education
  "EdTech",
  "Tutoring",
  "Curriculum Design",
  "Assessment",
  "Language Learning",
  // Environment & Agriculture
  "Climate Modeling",
  "Precision Agriculture",
  "Environmental Monitoring",
  "Renewable Energy",
  "Waste Management",
  // Media & Entertainment
  "Gaming",
  "Music Production",
  "Video Production",
  "Content Moderation",
  "Social Media",
  // Government & Public
  "Smart Cities",
  "Public Safety",
  "Transportation",
  "Urban Planning",
  "Disaster Response",
  // Finance
  "Trading",
  "Risk Assessment",
  "Fraud Detection",
  "Credit Scoring",
  "Portfolio Management",
  // Other
  "Real Estate",
  "Hospitality",
  "Manufacturing",
  "Logistics",
  "Telecommunications",
];

/** Flatten all skills into a single array. */
export const ALL_OASF_SKILLS: string[] = OASF_SKILL_CATEGORIES.flatMap(
  (cat) => cat.skills
);
