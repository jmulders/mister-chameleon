/**
 * UI Components barrel export
 *
 * Exports interactive UI components and form atoms.
 * Import from here to keep consumer imports clean:
 *   import { Button, Card, Badge, Link }           from "@/components/ui";
 *   import { Input, Textarea, Select, FormField }  from "@/components/ui";
 *
 * Layout / typography primitives live in @/components/primitives.
 * The unified atoms barrel lives in @/components/atoms.
 * Content blocks live in @/components/blocks.
 */

// ── Interactive atoms ─────────────────────────────────────────────────────────
export { Button }                                    from "./Button";
export { Card, CardHeader, CardContent, CardFooter } from "./Card";
export { Badge }                                     from "./Badge";
export { Link }                                      from "./Link";

// ── Form atoms ────────────────────────────────────────────────────────────────
export { Input }     from "./Input";
export { Textarea }  from "./Textarea";
export { Select }    from "./Select";
export { FormField } from "./FormField";
