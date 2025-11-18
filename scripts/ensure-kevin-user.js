"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pg_1 = require("pg");
var shared_1 = require("@monorepo/shared");
function ensureKevinUser() {
    return __awaiter(this, void 0, void 0, function () {
        var pool, password, hashedPassword, existingUser, user, result, adminUser, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pool = new pg_1.Pool({
                        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:changeme_secure_password@localhost:55432/kevinalthaus',
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, 9, 11]);
                    password = '(130Bpm)';
                    return [4 /*yield*/, (0, shared_1.hashPassword)(password)];
                case 2:
                    hashedPassword = _a.sent();
                    return [4 /*yield*/, pool.query('SELECT id, email, username, role FROM users WHERE username = $1', ['kevin'])];
                case 3:
                    existingUser = _a.sent();
                    if (!(existingUser.rows.length > 0)) return [3 /*break*/, 5];
                    // Update existing user's password
                    return [4 /*yield*/, pool.query('UPDATE users SET password_hash = $1, role = $2, updated_at = NOW() WHERE username = $3', [hashedPassword, 'admin', 'kevin'])];
                case 4:
                    // Update existing user's password
                    _a.sent();
                    user = existingUser.rows[0];
                    // eslint-disable-next-line no-console
                    console.log('✓ Admin user password updated successfully:');
                    // eslint-disable-next-line no-console
                    console.log('  Email:', user.email);
                    // eslint-disable-next-line no-console
                    console.log('  Username:', user.username);
                    // eslint-disable-next-line no-console
                    console.log('  Role:', user.role);
                    // eslint-disable-next-line no-console
                    console.log('  ID:', user.id);
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, pool.query("INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)\n         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())\n         RETURNING id, email, username, role", ['kevin@kevinalthaus.com', 'kevin', hashedPassword, 'admin'])];
                case 6:
                    result = _a.sent();
                    adminUser = result.rows[0];
                    // eslint-disable-next-line no-console
                    console.log('✓ Admin user created successfully:');
                    // eslint-disable-next-line no-console
                    console.log('  Email:', adminUser.email);
                    // eslint-disable-next-line no-console
                    console.log('  Username:', adminUser.username);
                    // eslint-disable-next-line no-console
                    console.log('  Role:', adminUser.role);
                    // eslint-disable-next-line no-console
                    console.log('  ID:', adminUser.id);
                    _a.label = 7;
                case 7: return [3 /*break*/, 11];
                case 8:
                    error_1 = _a.sent();
                    // eslint-disable-next-line no-console
                    console.error('✗ Error ensuring kevin user:', error_1);
                    process.exit(1);
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, pool.end()];
                case 10:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    });
}
void ensureKevinUser();
