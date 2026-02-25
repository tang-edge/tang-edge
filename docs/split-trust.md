# Split Trust Examples

Production deployment patterns using `clevis sss` (Shamir's Secret Sharing) to distribute trust across multiple Tang servers. All examples include WAF IP restriction and LUKS passphrase fallback.

| Setup | Best for | Servers needed | Auto-unlock if 1 down | Kill switch |
|-------|----------|---------------|----------------------|-------------|
| [2-of-2: Minimal](#2-of-2-minimal-setup) | Max security, VPS | 2 cloud | No → passphrase | Disable either provider |
| [2-of-3: Homelab](#2-of-3-homelab--on-prem--2-cloud--1-lan) | Homelab, on-prem | 2 cloud + 1 LAN | Yes (2 of 3) | Disable either cloud |
| [2-of-3: VPS](#2-of-3-vps-in-datacenter--3-cloud-providers) | Remote VPS, no LAN | 3 cloud | Yes (2 of 3) | Disable any provider |
| [Corporate + VPN](#corporate-laptop--vpn) | Laptops, corp fleet | 1 corp infra | No → passphrase | Disable worker |

## 2-of-2: Minimal Setup

Simplest split trust setup. Both servers must respond — if either is unavailable, falls back to password.

```
VPS (Fixed IP: x.x.x.x)
  │
  ├─── tang-edge on Provider A (WAF → fixed IP only)
  ├─── tang-edge on Provider B (WAF → fixed IP only)
  │
  └─── clevis sss: t=2, both required ──► LUKS open
       + LUKS passphrase slot           ──► fallback
```

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [
      {"url": "https://tang.provider-a.example.dev"},
      {"url": "https://tang.provider-b.example.dev"}
    ]
  }
}'
```

| Scenario | Result |
|----------|--------|
| Server stolen (powered off) | Wrong IP → both reject → **locked** |
| One provider compromised | 1 share, need both + correct IP → **safe** |
| One provider down | 1/2 → **password fallback** |

**Best for**: setups where security matters more than convenience. One provider down = manual password entry.

## 2-of-3: Homelab / On-Prem — 2 cloud + 1 LAN

Local network has a dedicated Tang machine. Two cloud tang-edge instances add redundancy and kill-switch capability:

```
VPS (Fixed IP: x.x.x.x)
  │
  ├─── tang-edge on Provider A (WAF → fixed IP only)
  ├─── tang-edge on Provider B (WAF → fixed IP only)
  ├─── tang (original) on a separate LAN machine
  │
  └─── clevis sss: t=2, any 2 of 3 ──► LUKS open
       + LUKS passphrase slot         ──► fallback
```

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [
      {"url": "http://192.168.1.10"},
      {"url": "https://tang.provider-a.example.dev"},
      {"url": "https://tang.provider-b.example.dev"}
    ]
  }
}'
```

| Scenario | Result |
|----------|--------|
| Server stolen (powered off) | Wrong IP → cloud servers reject → **locked** |
| One cloud account compromised | 1 share, need 1 more + correct IP → **safe** |
| Internet outage | Only local Tang = 1/3 → **password fallback** |
| One provider down | Other cloud + local = 2/3 → **unlocks** |
| Local Tang down | Cloud A + Cloud B = 2/3 → **unlocks** |

**Best for**: homelab, on-prem servers with local network access.

## 2-of-3: VPS in Datacenter — 3 cloud providers

No local network available. All Tang instances are cloud tang-edge on different providers, each behind WAF with IP restriction:

```
VPS (Fixed IP: x.x.x.x)
  │
  ├─── tang-edge on Provider A (WAF → fixed IP only)
  ├─── tang-edge on Provider B (WAF → fixed IP only)
  ├─── tang-edge on Provider C (WAF → fixed IP only)
  │
  └─── clevis sss: t=2, any 2 of 3 ──► LUKS open
       + LUKS passphrase slot         ──► fallback
```

```bash
clevis luks bind -d /dev/sdX sss '{
  "t": 2,
  "pins": {
    "tang": [
      {"url": "https://tang.provider-a.example.dev"},
      {"url": "https://tang.provider-b.example.dev"},
      {"url": "https://tang.provider-c.example.dev"}
    ]
  }
}'
```

| Scenario | Result |
|----------|--------|
| Server stolen (powered off) | Wrong IP → all 3 reject → **locked** |
| One provider compromised | 1 share, need 1 more + correct IP → **safe** |
| One provider down | Other 2 = 2/3 → **unlocks** |
| Two providers down simultaneously | 1/3 → **password fallback** |

**Best for**: remote VPS/dedicated servers without local network.

> Use different cloud providers (e.g. Cloudflare + AWS + Deno Deploy) to avoid correlated outages.

## Offsite Backups

With any setup above, encrypted disk images and LUKS partition dumps can be safely stored on any untrusted remote storage (S3, Backblaze B2, rsync.net, etc.). The backup is just encrypted data — decryption requires the Tang servers responding from the correct IP. Even if the backup storage is fully compromised, the data is unreadable without the Tang key shares.

## Corporate Laptop + VPN

tang-edge deployed on corporate infrastructure acts as a network-bound unlock factor for employee laptops. The VPN becomes the location boundary — no additional tang server needed at home.

```
Corporate laptop:
  │
  └─── tang-edge on corporate infra (WAF → VPN IP pool only)
       + LUKS passphrase slot ──► fallback
```

```bash
clevis luks bind -d /dev/sdX tang '{"url": "https://tang.corp.example.com"}'
```

| Scenario | Result |
|----------|--------|
| At office (corporate network, wired) | tang responds → **auto-unlock** |
| At home (wired ethernet, no VPN needed) | tang responds → **auto-unlock** |
| Laptop lost/stolen | tang rejects (wrong IP) → **locked** |
| VPN credentials compromised (no laptop) | No LUKS header → **nothing to decrypt** |

**Kill switch**: disable the tang-edge worker → all laptops lock on next reboot, no MDM required.

**WAF rule** (Cloudflare example): restrict `/rec/*` to your VPN IP pool:

```
(ip.src ne VPN_IP_1 and ip.src ne VPN_IP_2) → Block
```

**Requires wired ethernet at boot.** Network-bound disk encryption runs in initramfs before the OS starts — WiFi drivers and WPA2/3 authentication are not available at that stage. At home a docking station or ethernet cable is required for auto-unlock. Without wired connection the disk stays locked until passphrase fallback is entered manually.

**Note on home VPN**: VPN client starts after the OS is up, so it cannot be used for the initial disk unlock at boot. Auto-unlock at home requires wired ethernet directly on the home network — not VPN.

**Best for**: corporate fleets with docking stations, developer laptops on wired home networks.

## Key Rotation Warning

Rotating tang keys via `POST /rotate` replaces the server's private keys. Any existing `clevis` binding will **fail to unlock** after rotation — the LUKS slot becomes permanently inaccessible without the passphrase fallback.

**Rotation is an event-driven operation, not a scheduled one.** Tang's security model means the private key alone is useless without the LUKS header — periodic rotation provides little security benefit and creates operational risk.

Rotate only when:
- KV storage compromise is suspected
- Admin with `ROTATE_TOKEN` access leaves (corporate deployment)
- Decommissioning the tang-edge instance

**If you do rotate**: trigger `POST /rotate` while the disk is already unlocked, then immediately re-bind using `clevis luks bind` before rebooting. See [clevis documentation](https://github.com/latchset/clevis) for the re-binding procedure.

The bigger operational risk is **key loss** (provider deletes your account), not key compromise. See Tang Key Backup below.

## Tang Key Backup

Tang private keys are stored in the provider's KV storage. If the provider account is banned, deleted, or suffers data loss, the keys are gone and the disk **cannot be unlocked** except via passphrase fallback.

**Export keys before any provider changes:**

```bash
# Fetch the public advertisement (contains public keys only — safe to store anywhere)
curl https://tang-edge.example.dev/adv | jq . > tang-adv-backup.json
```

The private keys are not exportable via the API by design (Tang protocol). To back them up, export directly from the provider's KV storage via their dashboard or API before decommissioning.

For production setups: keep at least one LUKS passphrase slot and store it in a password manager or hardware security key.

## Monitoring

Unexpected requests to `/rec/:thp` can indicate a stolen disk being used to attempt unlock:

- Request from an IP outside your known pool at an unusual time
- Multiple rapid requests in sequence (automated unlock attempt)

Enable WAF logging on `/rec/*` and alert on anomalies. If a theft is suspected, trigger the kill switch immediately: disable the tang-edge worker → disk locks on next reboot.

## Recommendations

- **Always keep a LUKS passphrase slot** as ultimate fallback
- **Use different providers** for each tang-edge instance to avoid correlated failures
- **WAF + Fixed IP** on cloud providers adds a network-level restriction on top of the cryptographic protocol
- **Password complexity**: the LUKS passphrase should be strong — it's your last line of defense
- **Re-bind before rotating** tang keys — existing bindings break on rotation
- **Export KV keys before decommissioning** a provider — they cannot be recovered after deletion
