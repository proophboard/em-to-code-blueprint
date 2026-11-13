import {initializeMessageFactory} from "@lib/message-factory/message-factory";
import {MachineClock} from "@lib/system-clock/machine-clock";
import {CryptoUuidGenerator} from "@lib/uuid-generator/crypto-uuid-generator";

initializeMessageFactory(new MachineClock(), new CryptoUuidGenerator());
