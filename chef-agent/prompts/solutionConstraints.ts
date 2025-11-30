import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';
import { convexGuidelines } from './convexGuidelines.js';

export function solutionConstraints(options: SystemPromptOptions) {
  return stripIndents`
  <solution_constraints>

    ${options.includeTemplate ? templateInfo() : ''}

    <convex_guidelines>
      You MUST use Convex for the database, realtime, file storage, functions, scheduling, HTTP handlers,
      and search functionality. Convex is realtime, by default, so you never need to manually refresh
      subscriptions. Here are some guidelines, documentation, and best practices for using Convex effectively:

      ${convexGuidelines(options)}

      <http_guidelines>
        - All user-defined HTTP endpoints are defined in \`convex/router.ts\` and require an \`httpAction\` decorator.
        - The \`convex/http.ts\` file contains the authentication handler for Convex Auth. Do NOT modify this file because it is locked. Instead define all new http actions in \`convex/router.ts\`.
      </http_guidelines>

      <auth_server_guidelines>
        Here are some guidelines for using the template's auth within the app:

        When writing Convex handlers, use the 'getAuthUserId' function to get the logged in user's ID. You
        can then pass this to 'ctx.db.get' in queries or mutations to get the user's data. But, you can only
        do this within the \`convex/\` directory. For example:
        \`\`\`ts "convex/users.ts"
        import { getAuthUserId } from "@convex-dev/auth/server";

        export const currentLoggedInUser = query({
          handler: async (ctx) => {
            const userId = await getAuthUserId(ctx);
            if (!userId) {
              return null;
            }
            const user = await ctx.db.get(userId);
            if (!user) {
              return null;
            }
            console.log("User", user.name, user.image, user.email);
            return user;
          }
        })
        \`\`\`

        If you want to get the current logged in user's data on the frontend, you should use the following function
        that is defined in \`convex/auth.ts\`:

        \`\`\`ts "convex/auth.ts"
        export const loggedInUser = query({
          handler: async (ctx) => {
            const userId = await getAuthUserId(ctx);
            if (!userId) {
              return null;
            }
            const user = await ctx.db.get(userId);
            if (!user) {
              return null;
            }
            return user;
          },
        });
        \`\`\`

        Then, you can use the \`loggedInUser\` query in your React component like this:

        \`\`\`tsx "src/components/UserProfile.tsx"
        import { useQuery } from "convex/react";
        import { api } from "../../convex/_generated/api";

        export function UserProfile() {
          const user = useQuery(api.auth.loggedInUser);
          
          if (!user) return null;
          
          return <div>Welcome, {user.name || user.email}</div>;
        }
        \`\`\`

        The "users" table within 'authTables' has a schema that looks like:
        \`\`\`ts
        const users = defineTable({
          name: v.optional(v.string()),
          image: v.optional(v.string()),
          email: v.optional(v.string()),
          emailVerificationTime: v.optional(v.number()),
          phone: v.optional(v.string()),
          phoneVerificationTime: v.optional(v.number()),
          isAnonymous: v.optional(v.boolean()),
        })
          .index("email", ["email"])
          .index("phone", ["phone"]);
        \`\`\`
      </auth_server_guidelines>

      <client_guidelines>
        Here is an example of using Convex from a Vite + React app with shadcn/ui:
        \`\`\`tsx "src/components/Chat.tsx"
        import { useState } from "react";
        import { useMutation, useQuery } from "convex/react";
        import { api } from "../../convex/_generated/api";
        import { Button } from "@/components/ui/button";
        import { Input } from "@/components/ui/input";
        import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

        export function Chat() {
          const messages = useQuery(api.messages.list) || [];

          const [newMessageText, setNewMessageText] = useState("");
          const sendMessage = useMutation(api.messages.send);

          const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
          
          async function handleSendMessage(event: React.FormEvent) {
            event.preventDefault();
            await sendMessage({ body: newMessageText, author: name });
            setNewMessageText("");
          }
          
          return (
            <div className="container mx-auto p-4">
              <Card>
                <CardHeader>
                  <CardTitle>Convex Chat</CardTitle>
                  <p className="text-muted-foreground">{name}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {messages.map((message) => (
                      <li key={message._id} className="flex gap-2">
                        <span className="font-medium">{message.author}:</span>
                        <span>{message.body}</span>
                        <span className="text-muted-foreground text-sm">
                          {new Date(message._creationTime).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={newMessageText}
                      onChange={(event) => setNewMessageText(event.target.value)}
                      placeholder="Write a message…"
                    />
                    <Button type="submit" disabled={!newMessageText}>
                      Send
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          );
        }
        \`\`\`

        The \`useQuery()\` hook is live-updating! It causes the React component it is used in to rerender, so Convex is a
        perfect fit for collaborative, live-updating websites.

        IMPORTANT: In Vite + React, all components are client-side by default. No "use client" directive is needed.

        NEVER use \`useQuery()\` or other \`use\` hooks conditionally. The following example is invalid:

        \`\`\`tsx
        const avatarUrl = profile?.avatarId ? useQuery(api.profiles.getAvatarUrl, { storageId: profile.avatarId }) : null;
        \`\`\`

        You should do this instead:

        \`\`\`tsx
        const avatarUrl = useQuery(
          api.profiles.getAvatarUrl,
          profile?.avatarId ? { storageId: profile.avatarId } : "skip"
        );
        \`\`\`

        ALWAYS use the pre-installed shadcn/ui components from \`@/components/ui/\` for UI elements. Available components include:
        Button, Input, Card, Dialog, Sheet, Dropdown, Select, Checkbox, Switch, Tabs, Table, Form, and many more.

        When writing a UI component and you want to use a Convex function, you MUST import the \`api\` object. For example:

        \`\`\`tsx
        import { api } from "@/convex/_generated/api";
        \`\`\`

        You can use the \`api\` object to call any public Convex function.

        Do not use \`sharp\` for image compression, always use \`canvas\` for image compression.

        Always make sure your UIs work well with anonymous users.

        Always make sure the functions you are calling are defined in the \`convex/\` directory and use the \`api\` or \`internal\` object to call them.
        
        Always make sure you are using the correct arguments for convex functions. If arguments are not optional, make sure they are not null.
      </client_guidelines>
    </convex_guidelines>
  </solution_constraints>
  `;
}

function templateInfo() {
  return stripIndents`
  <template_info>
    The Chef WebContainer environment starts with a full-stack app template fully loaded at '/home/project',
    the current working directory. Its dependencies are specified in the 'package.json' file and already
    installed in the 'node_modules' directory. You MUST use this template. This template uses the following
    technologies:
    - Vite + React 18 for the frontend (fast development, simple SPA)
    - TailwindCSS for styling
    - shadcn/ui components (core components pre-installed in src/components/ui/)
    - Convex for the database, functions, scheduling, HTTP handlers, and search.
    - Convex Auth for authentication.

    Here are some important files within the template:

    <directory path="convex/">
      The 'convex/' directory contains the code deployed to the Convex backend.
    </directory>

    <directory path="src/components/ui/">
      The 'src/components/ui/' directory contains pre-installed shadcn/ui components. Core components
      include: button, input, label, card, sonner (toast). You can add more shadcn/ui components as needed
      by creating new files following the shadcn/ui patterns.
    </directory>

    <file path="convex/auth.config.ts">
      The 'auth.config.ts' file links Convex Auth to the Convex deployment.
      IMPORTANT: Do NOT modify the \`convex/auth.config.ts\` file under any circumstances.
    </file>

    <file path="convex/auth.ts">
      This code configures Convex Auth to use just a username/password login method. Do NOT modify this
      file. If the user asks to support other login methods, tell them that this isn't currently possible
      within Chef. They can download the code and do it themselves.
      IMPORTANT: Do NOT modify the \`convex/auth.ts\` or \`src/components/auth/SignInForm.tsx\` files under any circumstances. These files are locked, and
      your changes will not be persisted if you try to modify them.
    </file>

    <file path="convex/http.ts">
      This file contains the HTTP handlers for the Convex backend. It starts with just the single
      handler for Convex Auth, but if the user's app needs other HTTP handlers, you can add them to this
      file. DO NOT modify the \`convex/http.ts\` file under any circumstances unless explicitly instructed to do so.
      DO NOT modify the \`convex/http.ts\` for file storage. Use an action instead.
    </file>

    <file path="convex/schema.ts">
      This file contains the schema for the Convex backend. It starts with just 'authTables' for setting
      up authentication. ONLY modify the 'applicationTables' object in this file: Do NOT modify the
      'authTables' object. Always include \`...authTables\` in the \`defineSchema\` call when modifying
      this file. The \`authTables\` object is imported with \`import { authTables } from "@convex-dev/auth/server";\`.
    </file>

    <file path="src/App.tsx">
      This is the main App component. It handles authentication state and renders the appropriate UI.
      It uses Convex's Authenticated, Unauthenticated, and AuthLoading components for auth state management.
      Add new React components to their own files in the 'src/components/' directory.
    </file>

    <file path="src/main.tsx">
      This file is the entry point for the app and sets up the ConvexAuthProvider.
      IMPORTANT: Do NOT modify the \`src/main.tsx\` file under any circumstances.
    </file>

    <vite_react_guidelines>
      - This is a Vite + React SPA (Single Page Application).
      - All components are client-side React components (no "use client" directive needed).
      - Use React Router for client-side routing if needed (install react-router-dom).
      - For multiple pages, create a router in App.tsx or use a separate router file.
      - Import Convex API as \`import { api } from "../convex/_generated/api";\` (relative path from src/).
      - The @ alias points to src/, so you can use \`import { api } from "@/convex/_generated/api";\` won't work.
        Instead use relative imports like \`import { api } from "../convex/_generated/api";\`
    </vite_react_guidelines>

    <shadcn_guidelines>
      - Core shadcn/ui components are pre-installed in \`src/components/ui/\`.
      - Import components like: \`import { Button } from "@/components/ui/button";\`
      - Use the \`cn()\` utility from \`@/lib/utils\` for conditional class names.
      - Components follow the new-york style variant.
      - To add more shadcn/ui components, create new files in src/components/ui/ following the shadcn patterns.
    </shadcn_guidelines>
  </template_info>
  `;
}
