// Common abstractions for Health Data Providers

export type ConnectionResult = {
  success: boolean;
  message?: string;
  authUrl?: string;
};

export type DateRange = {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
};

export type BodyMeasurement = {
  measuredAt: string;
  metric: "weight" | "body_fat_pct" | "muscle_mass_kg" | "waist_cm";
  value: number;
  source: string;
};

export type ImportedActivity = {
  externalId: string;
  activityType: string;
  activityName?: string;
  startedAt: string;
  durationSeconds: number;
  distanceMeters?: number;
  caloriesKcal?: number;
  averageHeartRate?: number;
};

export type DailyHealthSummary = {
  date: string;
  sleepHours?: number;
  steps?: number;
  activeCalories?: number;
};

export type BackfillResult = {
  importedCount: number;
  duplicatesCount: number;
};

export interface HealthDataProvider {
  connect(userId: string): Promise<ConnectionResult>;
  disconnect(userId: string): Promise<void>;

  getBodyMeasurements(userId: string, range: DateRange): Promise<BodyMeasurement[]>;
  getActivities(userId: string, range: DateRange): Promise<ImportedActivity[]>;
  getDailySummaries(userId: string, range: DateRange): Promise<DailyHealthSummary[]>;
  backfill(userId: string, range: DateRange): Promise<BackfillResult>;
}

// 1. Manual Provider Implementation
export class ManualHealthDataProvider implements HealthDataProvider {
  async connect(userId: string): Promise<ConnectionResult> {
    return { success: true };
  }
  async disconnect(userId: string): Promise<void> {}
  async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    return [];
  }
  async getActivities(): Promise<ImportedActivity[]> {
    return [];
  }
  async getDailySummaries(): Promise<DailyHealthSummary[]> {
    return [];
  }
  async backfill(): Promise<BackfillResult> {
    return { importedCount: 0, duplicatesCount: 0 };
  }
}

// 2. Garmin CSV Import Provider
export class GarminCsvImportProvider implements HealthDataProvider {
  async connect(userId: string): Promise<ConnectionResult> {
    return { success: true };
  }
  async disconnect(userId: string): Promise<void> {}
  
  // Custom CSV parser logic
  parseCsv(content: string): BodyMeasurement[] {
    const rows = content.split(/\r?\n/);
    const measurements: BodyMeasurement[] = [];

    // Parse simple CSV rows (handling commas vs decimals)
    rows.slice(1).forEach((row) => {
      const cols = row.split(/[;,]/);
      if (cols.length >= 2) {
        const dateStr = cols[0].trim();
        const weightVal = parseFloat(cols[1].trim().replace(",", "."));
        
        if (dateStr && !isNaN(weightVal)) {
          measurements.push({
            measuredAt: new Date(dateStr).toISOString(),
            metric: "weight",
            value: weightVal,
            source: "csv_import",
          });
        }
      }
    });

    return measurements;
  }

  async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    return [];
  }
  async getActivities(): Promise<ImportedActivity[]> {
    return [];
  }
  async getDailySummaries(): Promise<DailyHealthSummary[]> {
    return [];
  }
  async backfill(): Promise<BackfillResult> {
    return { importedCount: 0, duplicatesCount: 0 };
  }
}

// 3. Garmin File Import Provider (FIT, TCX, GPX, ZIP)
export class GarminFileImportProvider implements HealthDataProvider {
  async connect(userId: string): Promise<ConnectionResult> {
    return { success: true };
  }
  async disconnect(userId: string): Promise<void> {}
  async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    return [];
  }
  async getActivities(): Promise<ImportedActivity[]> {
    return [];
  }
  async getDailySummaries(): Promise<DailyHealthSummary[]> {
    return [];
  }
  async backfill(): Promise<BackfillResult> {
    return { importedCount: 0, duplicatesCount: 0 };
  }
}

// 4. Strava Activity Provider (OAuth linked)
export class StravaActivityProvider implements HealthDataProvider {
  async connect(userId: string): Promise<ConnectionResult> {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/strava/callback`;
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=activity:read_all&state=strava-state-12345`;

    return { success: true, authUrl };
  }

  async disconnect(userId: string): Promise<void> {}
  async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    return [];
  }
  async getActivities(): Promise<ImportedActivity[]> {
    return [];
  }
  async getDailySummaries(): Promise<DailyHealthSummary[]> {
    return [];
  }
  async backfill(): Promise<BackfillResult> {
    return { importedCount: 0, duplicatesCount: 0 };
  }
}

// 5. Garmin Official API Provider (Feature flagged placeholder)
export class GarminOfficialApiProvider implements HealthDataProvider {
  async connect(userId: string): Promise<ConnectionResult> {
    if (process.env.GARMIN_OFFICIAL_API_ENABLED !== "true") {
      return { success: false, message: "Garmin Health API ei ole käytössä (vaatii yritystunnuksen)." };
    }
    return { success: true };
  }

  async disconnect(userId: string): Promise<void> {}
  async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    return [];
  }
  async getActivities(): Promise<ImportedActivity[]> {
    return [];
  }
  async getDailySummaries(): Promise<DailyHealthSummary[]> {
    return [];
  }
  async backfill(): Promise<BackfillResult> {
    return { importedCount: 0, duplicatesCount: 0 };
  }
}
