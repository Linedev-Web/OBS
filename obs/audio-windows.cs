// Audio de Windows pour la régie (obs/audio-windows.ps1) : lire le périphérique par défaut et le changer.
// Windows n'a pas de commande pour ça : on passe par ses interfaces COM (IMMDeviceEnumerator, IPolicyConfig, cette
// dernière non documentée mais stable depuis Windows 7, utilisée par le panneau Son lui-même).
using System;
using System.Runtime.InteropServices;

namespace RegieAudio
{
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints();
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        int Activate();
        int OpenPropertyStore();
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumerator { }

    // Seule SetDefaultEndpoint sert ; les dix méthodes avant elle gardent sa place dans l'interface.
    [Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPolicyConfig
    {
        int GetMixFormat(); int GetDeviceFormat(); int ResetDeviceFormat(); int SetDeviceFormat(); int GetProcessingPeriod();
        int SetProcessingPeriod(); int GetShareMode(); int SetShareMode(); int GetPropertyValue(); int SetPropertyValue();
        [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
    }

    [ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
    class PolicyConfigClient { }

    public static class Defaut
    {
        /// <summary>Identifiant du périphérique par défaut (flux 0 = sortie, 1 = entrée ; rôle 0 = son, 2 = communications).</summary>
        public static string Lire(int flux, int role)
        {
            IMMDevice device;
            var enumerateur = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            if (enumerateur.GetDefaultAudioEndpoint(flux, role, out device) != 0) return "";
            string id;
            return device.GetId(out id) == 0 ? id : "";
        }

        /// <summary>Fait de ce périphérique celui par défaut pour les trois rôles (son, multimédia, communications).</summary>
        public static int Choisir(string id)
        {
            var politique = (IPolicyConfig)new PolicyConfigClient();
            int resultat = 0;
            for (int role = 0; role < 3; role++) resultat |= politique.SetDefaultEndpoint(id, role);
            return resultat;
        }
    }
}
