/**
 * UI Component Library (v1.16.0)
 *
 * Foundation components using the design token system.
 * All components support theming without `dark:` prefixes.
 *
 * @example
 * import { Button, Card, Input, Badge } from '@/components/ui';
 *
 * <Card variant="warm" padding="md">
 *   <CardHeader>
 *     <CardTitle>Form</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     <Input label="Email" placeholder="you@example.com" />
 *   </CardContent>
 * </Card>
 *
 * <Button variant="primary">Submit</Button>
 * <Badge variant="success">Active</Badge>
 */

// Button
export { Button, buttonVariants } from "./Button";
export type { ButtonProps } from "./Button";

// Card
export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
  cardVariants,
} from "./Card";
export type { CardProps } from "./Card";

// Input
export { Input, inputVariants } from "./Input";
export type { InputProps } from "./Input";

// Badge
export { Badge, badgeVariants } from "./Badge";
export type { BadgeProps } from "./Badge";

// Skeleton
export { Skeleton, skeletonVariants } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

// IconButton
export { IconButton, iconButtonVariants } from "./IconButton";
export type { IconButtonProps } from "./IconButton";

// Link
export { Link, linkVariants } from "./Link";
export type { LinkProps } from "./Link";

// Modal
export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
  ModalFooter,
  modalContentVariants,
} from "./Modal";
export type { ModalProps } from "./Modal";
