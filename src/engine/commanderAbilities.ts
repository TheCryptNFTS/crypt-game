export function getCommanderPassiveSummary(commanderId: string): string {
    switch (commanderId) {
      case "cmd_stone_warden":
        return "Stone Warden: Defensive commander. Built for tanky boards and sustain.";
  
      case "cmd_bronze_raider":
        return "Bronze Raider: Aggressive commander. Built for speed, pressure, and fast damage.";
  
      case "cmd_void_priest":
        return "Void Priest: Control spellcaster. Built for fear, disruption, and evasive play.";
  
      case "cmd_hell_judge":
        return "Hell Judge: Shadow commander. Built for infernal pressure and lifesteal-style combat.";
  
      case "cmd_clockwork_king":
        return "Clockwork King: Tech commander. Built for control, sync, and value engines.";
  
      case "cmd_grave_oracle":
        return "Grave Oracle: Graveyard commander. Built for death triggers and cursed recursion.";
  
      case "cmd_skull_emperor":
        return "Skull Emperor: Mythic royal finisher. Built for execute and closing games.";
  
      case "cmd_tempus_rex":
        return "Tempus Rex: Mythic time commander. Built for tempo swings and time manipulation.";
  
      case "cmd_anunnaki_prime":
        return "Anunnaki Prime: Mythic divine commander. Built for foresight and powerful setup.";
  
      case "cmd_harley_one":
        return "Harley: One-of-one commander. Built for chaotic cursed pressure.";
  
      case "cmd_lucifer_one":
        return "Lucifer: One-of-one infernal commander. Built for hellfire pressure and shadow payoff.";
  
      case "cmd_satoshi_one":
        return "Satoshi: One-of-one tech commander. Built for value, resources, and precision play.";
  
      default:
        return "Unknown commander passive.";
    }
  }