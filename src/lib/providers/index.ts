export * from "./provider";
export * from "./registry";
export * from "./pipeline";
export * from "./razorpay";

// Register providers at module load time
import { providerRegistry } from "./registry";
import { razorpayProvider } from "./razorpay";

providerRegistry.register(razorpayProvider);
