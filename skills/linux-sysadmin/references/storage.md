# Storage / Filesystem Reference (Ubuntu 24.04)

## Disk Status and Usage

```bash
# Overview
df -h                          # mounted filesystems, human-readable
df -ih                         # inode usage (important — can fill before disk space)
lsblk                          # block device tree
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT,UUID
fdisk -l                       # partition table (requires root)
blkid                          # UUIDs and filesystem types

# Find disk hogs
du -xsh /* 2>/dev/null | sort -rh | head -20    # top dirs at root (single fs)
du -xsh /var/log/* | sort -rh | head -10
du -sh /home/ubuntu/.pm2/logs/*

# Largest files
find /var -type f -size +100M -exec ls -lh {} \; 2>/dev/null
find /var/log -type f -name "*.log" -size +50M

# Inode exhaustion (df -ih shows 100% — but du shows space free)
df -ih /var           # check inodes
find /var/spool -type f | wc -l   # common culprit: mail queue
```

## Mount Points and fstab

```bash
# Current mounts
mount | column -t
cat /etc/fstab

# Mount options for performance / security
# /etc/fstab entry for data partition:
# UUID=xxxx  /data  ext4  defaults,noatime,errors=remount-ro  0  2
# noatime — don't update access time (significant I/O reduction)
# errors=remount-ro — read-only on error rather than data corruption

# Temporary mount
mount -o noatime /dev/sdb1 /mnt/data

# Remount read-write after error
mount -o remount,rw /

# Bind mount (map directory to another location)
mount --bind /data/uploads /var/www/app/uploads
# Persist in fstab: /data/uploads /var/www/app/uploads none bind 0 0
```

## LVM (Logical Volume Manager)

LVM allows online resizing of partitions. Useful when cloud disks are expanded.

```bash
# Current state
pvs                    # physical volumes
vgs                    # volume groups
lvs                    # logical volumes
lvdisplay /dev/ubuntu-vg/ubuntu-lv

# Online resize workflow (cloud disk expanded, e.g. from 50GB to 100GB)
# 1. Grow the partition (if using full disk LVM)
growpart /dev/sda 3    # grow partition 3 (cloud-init tool, apt install cloud-guest-utils)

# 2. Grow the physical volume
pvresize /dev/sda3

# 3. Extend the logical volume (100%FREE = use all available space)
lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv

# 4. Grow the filesystem (ext4)
resize2fs /dev/ubuntu-vg/ubuntu-lv

# 4. Grow the filesystem (xfs)
xfs_growfs /

# Verify
df -h /
```

### Snapshot for backup

```bash
# Create LVM snapshot (10G buffer for changes during backup)
lvcreate -L10G -s -n myapp-snap /dev/ubuntu-vg/ubuntu-lv

# Mount and backup
mount -o ro /dev/ubuntu-vg/myapp-snap /mnt/snap
rsync -az /mnt/snap/ /backup/destination/
umount /mnt/snap

# Remove snapshot
lvremove /dev/ubuntu-vg/myapp-snap
```

## File Permissions

```bash
# Standard permissions
chmod 644 file.txt      # rw-r--r-- (world-readable file)
chmod 755 dir/          # rwxr-xr-x (world-traversable dir)
chmod 600 .env          # rw------- (secrets)
chmod 700 ~/.ssh        # rwx------ (SSH dir)
chmod 640 /etc/app.conf # rw-r----- (group-readable)

# Recursive
chmod -R 755 /var/www
find /var/www -type f -exec chmod 644 {} \;    # files only
find /var/www -type d -exec chmod 755 {} \;    # dirs only

# Ownership
chown appuser:appgroup /opt/myapp
chown -R www-data:www-data /var/www

# SUID/SGID audit (should be minimal)
find / -xdev \( -perm -4000 -o -perm -2000 \) -type f 2>/dev/null
```

## ACLs (Access Control Lists)

ACLs extend standard Unix permissions with per-user/group rules.

```bash
# Check if ACL is enabled on filesystem
tune2fs -l /dev/sda1 | grep -i acl    # ext4
# Mount option: defaults,acl (usually enabled by default on ext4)

# View ACLs
getfacl /var/www/uploads

# Set ACL
setfacl -m u:deploy:rwx /var/www/uploads     # give user 'deploy' rwx
setfacl -m g:developers:rx /opt/myapp        # give group read+exec
setfacl -m o::--- /etc/ssl/private           # deny others completely
setfacl -R -m u:www-data:rx /var/www         # recursive

# Default ACL (applied to new files/dirs created inside)
setfacl -d -m u:www-data:rx /var/uploads     # new files inherit this ACL

# Remove ACL
setfacl -x u:deploy /var/www/uploads         # remove specific entry
setfacl -b /var/www/uploads                  # remove all ACLs
```

## File Capabilities

Capabilities allow fine-grained privilege grants without SUID.

```bash
# Give a binary permission to bind ports <1024 without root
setcap 'cap_net_bind_service=+ep' /usr/bin/node

# Verify
getcap /usr/bin/node    # node = cap_net_bind_service+ep

# Remove
setcap -r /usr/bin/node

# List all files with capabilities
find / -xdev -not -path "/proc/*" -exec getcap {} \; 2>/dev/null | grep -v "^$"
```

## inotify / File Watching

```bash
# Current inotify limits (may need raising for apps watching many files)
cat /proc/sys/fs/inotify/max_user_watches    # default 8192 — often too low
cat /proc/sys/fs/inotify/max_user_instances

# Raise limits (add to /etc/sysctl.d/99-inotify.conf)
echo "fs.inotify.max_user_watches = 524288" >> /etc/sysctl.d/99-inotify.conf
sysctl -p /etc/sysctl.d/99-inotify.conf

# Diagnose "too many open files" or "inotify limit reached"
# Symptom: Node.js webpack/vite watcher fails
# Symptom: journalctl "inotify: Watch limit reached"
cat /proc/sys/fs/inotify/max_user_watches
```

## Backup Tools

### rsync

```bash
# Sync directory (trailing slash = directory contents, not directory itself)
rsync -avz --delete /source/ /destination/

# Remote sync
rsync -avz -e "ssh -p 2222" /source/ user@remote:/destination/

# Exclude patterns
rsync -avz --exclude='*.log' --exclude='node_modules/' /source/ /dest/

# Dry run (preview)
rsync -avzn /source/ /destination/

# Backup with hard-link increments (time machine style)
rsync -a --link-dest=/backup/latest /source/ /backup/$(date +%Y-%m-%d)/
ln -sfn /backup/$(date +%Y-%m-%d) /backup/latest
```

### restic (deduplicated, encrypted backups)

```bash
# Initialize repository
restic init --repo /backup/myapp         # local
restic init --repo s3:s3.amazonaws.com/bucket/myapp  # S3

# Backup
RESTIC_PASSWORD=secret restic backup /opt/myapp --repo /backup/myapp

# List snapshots
restic snapshots --repo /backup/myapp

# Restore
restic restore latest --target /tmp/restore --repo /backup/myapp

# Prune old snapshots
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 \
  --prune --repo /backup/myapp
```

### borgbackup (deduplicated, compressed)

```bash
# Init (local)
borg init --encryption=repokey /backup/myapp

# Backup
borg create /backup/myapp::$(date +%Y-%m-%dT%H:%M) /opt/myapp /etc

# List
borg list /backup/myapp

# Extract
borg extract /backup/myapp::2026-01-15T02:00

# Prune
borg prune /backup/myapp --keep-daily 7 --keep-weekly 4

# Check integrity
borg check /backup/myapp
```

## Filesystem Health

```bash
# Check ext4 filesystem (unmounted or read-only)
fsck /dev/sdb1              # interactive (say yes to fixes)
fsck -n /dev/sdb1           # dry run (no changes)
e2fsck -f /dev/sdb1         # force check

# XFS repair
xfs_repair /dev/sdb1

# SMART disk health
apt install -y smartmontools
smartctl -a /dev/sda        # full report
smartctl -t short /dev/sda  # run short self-test
smartctl -H /dev/sda        # health summary

# Disk I/O stats
iostat -x 2 5               # extended stats every 2 sec, 5 times
iotop -o                    # processes doing I/O right now (interactive)
```

## logrotate

System-wide config: `/etc/logrotate.conf`. Per-app configs: `/etc/logrotate.d/`.

```
# /etc/logrotate.d/myapp
/var/log/myapp/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 appuser adm
    sharedscripts
    postrotate
        systemctl reload myapp > /dev/null 2>&1 || true
    endscript
}
```

```bash
# Test config (dry run)
logrotate -d /etc/logrotate.d/myapp

# Force rotation now
logrotate -f /etc/logrotate.d/myapp

# Run all (cron runs this daily)
logrotate /etc/logrotate.conf
```
