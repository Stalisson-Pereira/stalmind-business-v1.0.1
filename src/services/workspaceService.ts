import { Workspace } from '../types';
import { authService } from './authService';

export const workspaceService = {
  async getWorkspace(): Promise<Workspace> {
    return authService.getCurrentWorkspace();
  },

  async updateWorkspace(data: Partial<Workspace>): Promise<Workspace> {
    const current = await this.getWorkspace();
    const updated: Workspace = { ...current, ...data };
    return authService.updateWorkspace(updated);
  }
};
