export interface Exercise {
  name: string;
  description: string;
  durationSeconds: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  funFact: string;
  imageUrl?: string;
}

export interface BPReading {
  id: string;
  systolic: number;
  diastolic: number;
  timestamp: number;
  note?: string;
}

export interface HealthAnalysis {
  trend: string;
  advice: string;
  generatedAt: number;
}
