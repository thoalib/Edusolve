import { getSupabaseAdminClient } from '../config/supabase.js';
import webpush from 'web-push';

export class PushService {
    constructor() {
        this.admin = getSupabaseAdminClient();
        
        // Initialize web-push if keys are available
        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            webpush.setVapidDetails(
                process.env.VAPID_MAILTO || 'mailto:admin@example.com',
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
        } else {
            console.warn('[PushService] VAPID keys not configured. Push notifications will not work.');
        }
    }

    async saveSubscription(userId, subscription) {
        if (!this.admin) return { error: 'Admin client not available' };
        
        try {
            const { endpoint, keys } = subscription;
            
            if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
                return { error: 'Invalid subscription object' };
            }

            const { data, error } = await this.admin
                .from('push_subscriptions')
                .upsert({
                    user_id: userId,
                    endpoint: endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, endpoint' })
                .select();

            if (error) return { error: error.message };
            return { success: true };
        } catch (err) {
            console.error('[PushService.saveSubscription]', err);
            return { error: err.message };
        }
    }

    async getConfig() {
        if (!this.admin) return { error: 'Admin client not available' };
        
        const { data, error } = await this.admin
            .from('notification_delivery_config')
            .select('*')
            .order('event_type');
            
        if (error) return { error: error.message };
        return { configs: data || [] };
    }
    
    async updateConfig({ event_type, push_enabled, in_app_enabled }) {
         if (!this.admin) return { error: 'Admin client not available' };
         
         const { data, error } = await this.admin
            .from('notification_delivery_config')
            .update({ push_enabled, in_app_enabled, updated_at: new Date().toISOString() })
            .eq('event_type', event_type)
            .select()
            .single();
            
         if (error) return { error: error.message };
         return data;
    }

    async canSendPush(eventType) {
        if (!this.admin) return false;
        
        const { data } = await this.admin
            .from('notification_delivery_config')
            .select('push_enabled')
            .eq('event_type', eventType)
            .single();
            
        return data ? data.push_enabled : true; // Default to true if not found
    }

    async sendToUser(userId, payload, eventType = 'general') {
        if (!process.env.VAPID_PUBLIC_KEY) return { error: 'Push not configured' };
        if (!this.admin) return { error: 'Admin client not available' };
        
        // Check global config first
        const isEnabled = await this.canSendPush(eventType);
        if (!isEnabled) {
            return { skipped: true, reason: 'Disabled in config' };
        }

        // Get user subscriptions
        const { data: subs, error } = await this.admin
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (error || !subs || subs.length === 0) return { error: 'No subscriptions found' };

        const promises = subs.map(sub => {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            return webpush.sendNotification(pushSub, JSON.stringify(payload)).catch(err => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    // Subscription has expired or is no longer valid, we should delete it
                    return this.admin.from('push_subscriptions').delete().eq('id', sub.id);
                }
                console.error('Error sending push:', err);
            });
        });

        await Promise.all(promises);
        return { success: true, deliveredCount: subs.length };
    }

    // Admin broadcast
    async broadcast({ title, message, url, filters }) {
         if (!process.env.VAPID_PUBLIC_KEY) return { error: 'Push not configured' };
         if (!this.admin) return { error: 'Admin client not available' };
         
         // 1. Gather Students
         let targetUserIds = new Set();
         const roleFilter = filters?.role || 'all';
         const statusFilter = filters?.status;

         if (roleFilter === 'all' || roleFilter === 'student') {
              let q = this.admin.from('students').select('id').is('deleted_at', null);
              if (statusFilter) q = q.eq('status', statusFilter);
              const { data: stds } = await q;
              if (stds) stds.forEach(s => targetUserIds.add(s.id));
         }
         
         // 2. Gather Users (Staff / Teachers)
         if (roleFilter === 'all' || roleFilter !== 'student') {
             const { data: users, error: userError } = await this.admin.from('users').select('id, user_roles(roles(code))');
             
             if (!userError && users) {
                 let staffUsers = users.filter(u => {
                     if (roleFilter === 'all') return true;
                     const roles = Array.isArray(u.user_roles) ? u.user_roles : [u.user_roles];
                     if (roleFilter === 'staff') {
                         return !roles.some(ur => ur && ur.roles && ur.roles.code === 'teacher');
                     }
                     return roles.some(ur => ur && ur.roles && ur.roles.code === roleFilter);
                 });
                 
                 // If status filter is passed, we check teacher_profiles since users doesn't hold status
                 if (statusFilter) {
                     const { data: tProfs } = await this.admin.from('teacher_profiles').select('user_id, status');
                     const statusMap = new Map();
                     if (tProfs) tProfs.forEach(t => statusMap.set(t.user_id, t.status));
                     
                     staffUsers = staffUsers.filter(u => {
                         const roles = Array.isArray(u.user_roles) ? u.user_roles : [u.user_roles];
                         const isTeacher = roles.some(ur => ur?.roles?.code === 'teacher');
                         if (isTeacher) {
                             return statusMap.get(u.id) === statusFilter;
                         }
                         // For other roles, just act as if they pass the check if active is checked
                         return statusFilter === 'active'; 
                     });
                 }
                 staffUsers.forEach(u => targetUserIds.add(u.id));
             }
         }
         
         let targetArray = Array.from(targetUserIds);
         
         // 3. Additional Filter: Fees Pending
         if (filters?.feesPending) {
             const { data: pendingTopups } = await this.admin
                .from('student_topups')
                .select('student_id')
                .in('status', ['pending', 'partially_paid']);
                
             const { data: pendingPayments } = await this.admin
                .from('payment_requests')
                .select('student_id')
                .in('status', ['pending', 'partially_paid']);
                
             const pendingIds = new Set([
                 ...(pendingTopups || []).map(t => t.student_id),
                 ...(pendingPayments || []).map(p => p.student_id)
             ]);
             
             targetArray = targetArray.filter(id => pendingIds.has(id));
         }

         if (targetArray.length === 0) return { success: true, delivered: 0, totalMatched: 0, message: 'No users matched filters' };

         // 2. Get subscriptions for matching users
         const { data: subs, error: subError } = await this.admin
            .from('push_subscriptions')
            .select('*')
            .in('user_id', targetArray);
            
         if (subError) return { error: subError.message };
         if (!subs || subs.length === 0) return { success: true, delivered: 0, totalMatched: targetArray.length, message: 'No active subscriptions for matched users' };

         // 3. Send out notifications
         const payload = {
             title,
             message,
             url: url || '/',
             // Add timestamp so browser always triggers it
             timestamp: new Date().getTime() 
         };

         let delivered = 0;
         const promises = subs.map(sub => {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            return webpush.sendNotification(pushSub, JSON.stringify(payload)).then(() => {
                delivered++;
            }).catch(err => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    return this.admin.from('push_subscriptions').delete().eq('id', sub.id);
                }
            });
         });

         await Promise.all(promises);
         
         // Create an in-app notification for those targeted as well
         const inAppNotifs = targetArray.map(uid => ({
            user_id: uid,
            title: title,
            message: message,
            type: 'announcement',
            reference_id: null
         }));
         
         if (inAppNotifs.length > 0) {
             await this.admin.from('notifications').insert(inAppNotifs);
         }

         return { success: true, delivered, totalMatched: targetArray.length };
    }
}
