import { json, type ActionFunctionArgs } from '@vercel/remix';

/**
 * Auto-provision a Convex project for a user without requiring them to have a Convex account.
 * Projects are created under YOUR Convex team using your service credentials.
 * 
 * Required environment variables:
 * - CONVEX_SERVICE_TOKEN: Your Convex access token (from dashboard.convex.dev -> Settings -> Access Tokens)
 * - CONVEX_TEAM_SLUG: Your team slug where projects will be created
 * - PROVISION_HOST: Convex API host (default: https://api.convex.dev)
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const CONVEX_SERVICE_TOKEN = globalThis.process.env.CONVEX_SERVICE_TOKEN;
  const CONVEX_TEAM_SLUG = globalThis.process.env.CONVEX_TEAM_SLUG;
  const PROVISION_HOST = globalThis.process.env.PROVISION_HOST || 'https://api.convex.dev';

  if (!CONVEX_SERVICE_TOKEN || !CONVEX_TEAM_SLUG) {
    console.error('Missing CONVEX_SERVICE_TOKEN or CONVEX_TEAM_SLUG environment variables');
    return json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { userId, projectName } = body as { userId?: string; projectName?: string };

    if (!userId) {
      return json({ error: 'userId is required' }, { status: 400 });
    }

    // Generate a unique project name based on user ID and timestamp
    const uniqueProjectName = projectName || `user-${userId}-${Date.now()}`;

    // Step 1: Create a new project under your team
    const createProjectResponse = await fetch(`${PROVISION_HOST}/api/create_project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONVEX_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        team: CONVEX_TEAM_SLUG,
        projectName: uniqueProjectName,
        deploymentType: 'dev',
      }),
    });

    if (!createProjectResponse.ok) {
      const errorText = await createProjectResponse.text();
      console.error('Failed to create project:', errorText);
      return json({ error: 'Failed to provision project' }, { status: 500 });
    }

    const projectData = await createProjectResponse.json() as {
      projectSlug: string;
      projectId: number;
      teamSlug: string;
      deploymentName: string;
      prodUrl: string; // This is actually the dev URL
      adminKey: string;
    };

    // Return the credentials needed to connect to the project
    return json({
      success: true,
      projectSlug: projectData.projectSlug,
      teamSlug: projectData.teamSlug,
      deploymentName: projectData.deploymentName,
      deploymentUrl: projectData.prodUrl,
      adminKey: projectData.adminKey,
    });
  } catch (error) {
    console.error('Error auto-provisioning Convex project:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
