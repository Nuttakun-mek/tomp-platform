export interface DriverReadinessInput {
  confirmedName: boolean;
  confirmedPhone: boolean;
  confirmedVehicle: boolean;
  vehiclePhotoCaptured: boolean;
  platePhotoCaptured: boolean;
}

export interface VehicleReadinessInput {
  vehicleType?: string | null;
  plateNumber?: string | null;
  capacity?: number | null;
  outOfService?: boolean;
}

export function checkDriverReadiness(input: DriverReadinessInput): boolean {
  return input.confirmedName && input.confirmedPhone && input.confirmedVehicle && input.vehiclePhotoCaptured && input.platePhotoCaptured;
}

export function checkVehicleReadiness(input: VehicleReadinessInput): boolean {
  return Boolean(input.vehicleType?.trim()) && Boolean(input.plateNumber?.trim()) && (input.capacity ?? 0) > 0 && !input.outOfService;
}

export function getDriverReadinessScore(input: DriverReadinessInput & { gpsConsent?: boolean }): number {
  const checks = [input.confirmedName, input.confirmedPhone, input.confirmedVehicle, input.vehiclePhotoCaptured, input.platePhotoCaptured, Boolean(input.gpsConsent)];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function getVehicleReadinessScore(input: VehicleReadinessInput & { photoCaptured?: boolean; platePhotoCaptured?: boolean }): number {
  const checks = [
    Boolean(input.vehicleType?.trim()),
    Boolean(input.plateNumber?.trim()),
    (input.capacity ?? 0) > 0,
    !input.outOfService,
    Boolean(input.photoCaptured),
    Boolean(input.platePhotoCaptured)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
