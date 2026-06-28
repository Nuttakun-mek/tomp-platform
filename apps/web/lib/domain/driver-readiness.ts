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
