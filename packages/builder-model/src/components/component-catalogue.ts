import {
  callToActionBlockComponent,
  heroBlockComponent,
  imageBlockComponent,
  questionBlockComponent,
  textBlockComponent,
} from "./block-components.js";
import { codeBlockComponent } from "./code-block-component.js";
import type { AnyComponentDefinition, ComponentDefinition } from "./component-definition.js";
import {
  buttonComponent,
  dividerComponent,
  headingComponent,
  imageComponent,
  linkComponent,
  listComponent,
  navigationComponent,
  quoteComponent,
  textComponent,
} from "./content-components.js";
import {
  boxComponent,
  columnsComponent,
  containerComponent,
  pageComponent,
  sectionComponent,
} from "./layout-components.js";

/**
 * The components every Lintel site has, in the order the Insert panel lists them. Sites add
 * their own (code components) by passing a longer list to `createComponentCatalogue`.
 */
export const standardComponents: readonly AnyComponentDefinition[] = [
  eraseProps(pageComponent),
  eraseProps(sectionComponent),
  eraseProps(containerComponent),
  eraseProps(boxComponent),
  eraseProps(columnsComponent),
  eraseProps(dividerComponent),
  eraseProps(headingComponent),
  eraseProps(textComponent),
  eraseProps(listComponent),
  eraseProps(quoteComponent),
  eraseProps(imageComponent),
  eraseProps(buttonComponent),
  eraseProps(linkComponent),
  eraseProps(navigationComponent),
  eraseProps(heroBlockComponent),
  eraseProps(textBlockComponent),
  eraseProps(imageBlockComponent),
  eraseProps(callToActionBlockComponent),
  eraseProps(questionBlockComponent),
  eraseProps(codeBlockComponent),
];

function eraseProps<Props extends Record<string, unknown>>(
  definition: ComponentDefinition<Props>,
): AnyComponentDefinition {
  return definition as unknown as AnyComponentDefinition;
}

export class DuplicateComponentTypeError extends Error {
  constructor(type: string) {
    super(`Two components have the type “${type}”. Each component needs its own type.`);
    this.name = "DuplicateComponentTypeError";
  }
}

/** The components a site can use, looked up by type. */
export interface ComponentCatalogue {
  readonly definitions: readonly AnyComponentDefinition[];
  find(type: string): AnyComponentDefinition | undefined;
  /** Whether a node of `childType` may go directly inside one of `parentType`. */
  canContain(parentType: string, childType: string): boolean;
}

export function createComponentCatalogue(
  definitions: readonly AnyComponentDefinition[] = standardComponents,
): ComponentCatalogue {
  const byType = new Map<string, AnyComponentDefinition>();
  for (const definition of definitions) {
    if (byType.has(definition.type)) {
      throw new DuplicateComponentTypeError(definition.type);
    }
    byType.set(definition.type, definition);
  }

  return {
    definitions,
    find: (type) => byType.get(type),
    canContain(parentType, childType) {
      const parent = byType.get(parentType);
      const child = byType.get(childType);
      if (!parent || !child || childType === "page") return false;
      if (child.allowedParents && !child.allowedParents.includes(parentType)) return false;
      if (parent.allowedChildren === "none") return false;
      if (parent.allowedChildren === "any") return true;
      return parent.allowedChildren.includes(childType);
    },
  };
}

export const standardCatalogue = createComponentCatalogue();
