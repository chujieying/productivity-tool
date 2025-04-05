"use client"

import { useState, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, MapPin, Heart } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import type { StudySpot } from "@/lib/types"

interface Filter {
  wifi: boolean
  food: boolean
  drinks: boolean
  charging: boolean
}

export default function StudySpotMap() {
  const [filters, setFilters] = useState<Filter>({
    wifi: false,
    food: false,
    drinks: false,
    charging: false,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [favoriteSpots, setFavoriteSpots] = useState<StudySpot[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mapUrl, setMapUrl] = useState("")
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false)

  // Fetch the Maps API key from the server
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch("/api/maps-key")
        const data = await response.json()
        if (data.apiKey) {
          setApiKeyLoaded(true)
          // Set initial map URL to Singapore
          setMapUrl(`https://www.google.com/maps/embed/v1/search?key=${data.apiKey}&q=study+spots+in+Singapore`)
        }
      } catch (error) {
        console.error("Error fetching Maps API key:", error)
      }
    }

    fetchApiKey()
  }, [])

  // Check for user session
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    fetchUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Load favorite spots when user changes
  useEffect(() => {
    if (user) {
      fetchFavoriteSpots()
    } else {
      // If no user, try to load from localStorage
      const savedSpots = localStorage.getItem("productivityHubFavoriteSpots")
      if (savedSpots) {
        try {
          setFavoriteSpots(JSON.parse(savedSpots))
        } catch (e) {
          console.error("Failed to parse saved spots", e)
        }
      }
      setLoading(false)
    }
  }, [user])

  // Save favorite spots to localStorage when they change (for non-authenticated users)
  useEffect(() => {
    if (!user && favoriteSpots.length >= 0) {
      localStorage.setItem("productivityHubFavoriteSpots", JSON.stringify(favoriteSpots))
    }
  }, [favoriteSpots, user])

  // Fetch favorite spots from Supabase
  const fetchFavoriteSpots = async () => {
    try {
      const { data, error } = await supabase.from("study_spots").select("*").eq("user_id", user.id)

      if (error) throw error

      if (data) setFavoriteSpots(data)
    } catch (error) {
      console.error("Error fetching favorite spots:", error)
    }
  }

  // Handle search and filter
  const handleSearch = async () => {
    if (!apiKeyLoaded) return

    try {
      // Fetch the API key again to ensure it's fresh
      const response = await fetch("/api/maps-key")
      const data = await response.json()
      const apiKey = data.apiKey

      // Build search query based on filters
      let query = searchQuery || "study spots"
      if (filters.wifi) query += " wifi"
      if (filters.food) query += " food"
      if (filters.drinks) query += " coffee"
      if (filters.charging) query += " power outlets"

      // Add Singapore to the query if not already included
      if (!query.toLowerCase().includes("singapore")) {
        query += " singapore"
      }

      // Update the map URL with the new search query
      setMapUrl(`https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(query)}`)
    } catch (error) {
      console.error("Error updating map search:", error)
    }
  }

  // Save a spot as favorite
  const saveSpot = async (name: string, address: string) => {
    if (!user) {
      saveLocalSpot(name, address)
      return
    }

    try {
      // Create a simple spot object with basic info
      const newSpot = {
        user_id: user.id,
        name,
        address,
        latitude: 0, // We don't have precise coordinates in this simplified version
        longitude: 0,
        has_wifi: filters.wifi,
        has_food: filters.food,
        has_drinks: filters.drinks,
        has_charging: filters.charging,
        notes: "Added from search",
      }

      const { data, error } = await supabase.from("study_spots").insert([newSpot]).select()

      if (error) throw error

      if (data) {
        setFavoriteSpots([...favoriteSpots, ...data])
        alert("Spot saved to favorites!")
      }
    } catch (error) {
      console.error("Error saving spot:", error)
      alert("Failed to save spot. Please try again.")
    }
  }

  // Save a spot as favorite to localStorage
  const saveLocalSpot = (name: string, address: string) => {
    const newSpot = {
      id: Date.now().toString(),
      user_id: "local",
      name,
      address,
      latitude: 0,
      longitude: 0,
      has_wifi: filters.wifi,
      has_food: filters.food,
      has_drinks: filters.drinks,
      has_charging: filters.charging,
      notes: "Added from search",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setFavoriteSpots([...favoriteSpots, newSpot])
    alert("Spot saved to favorites! Sign in to sync across devices.")
  }

  // Toggle filter
  const toggleFilter = (filter: keyof Filter) => {
    setFilters((prev) => ({
      ...prev,
      [filter]: !prev[filter],
    }))
  }

  // View a favorite spot
  const viewFavoriteSpot = async (spot: StudySpot) => {
    if (!apiKeyLoaded) return

    try {
      // Fetch the API key again to ensure it's fresh
      const response = await fetch("/api/maps-key")
      const data = await response.json()
      const apiKey = data.apiKey

      // Update the map URL to show the favorite spot
      setMapUrl(
        `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(spot.name + " " + (spot.address || "Singapore"))}`,
      )
    } catch (error) {
      console.error("Error viewing favorite spot:", error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Search for study spots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 mt-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="filter-wifi" checked={filters.wifi} onCheckedChange={() => toggleFilter("wifi")} />
            <label htmlFor="filter-wifi">Wi-Fi</label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="filter-food" checked={filters.food} onCheckedChange={() => toggleFilter("food")} />
            <label htmlFor="filter-food">Food</label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="filter-drinks" checked={filters.drinks} onCheckedChange={() => toggleFilter("drinks")} />
            <label htmlFor="filter-drinks">Drinks</label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-charging"
              checked={filters.charging}
              onCheckedChange={() => toggleFilter("charging")}
            />
            <label htmlFor="filter-charging">Charging Points</label>
          </div>
        </div>
      </div>

      {favoriteSpots.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Your Favorite Spots</h3>
          <div className="flex flex-wrap gap-2">
            {favoriteSpots.map((spot) => (
              <Button key={spot.id} variant="outline" size="sm" onClick={() => viewFavoriteSpot(spot)}>
                <Heart className="h-3 w-3 mr-1 text-red-500" />
                {spot.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="w-full h-[400px] rounded-lg border overflow-hidden">
        {apiKeyLoaded && mapUrl ? (
          <iframe
            title="Google Maps"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={mapUrl}
          ></iframe>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center">
              <MapPin className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-500">Loading map...</p>
              <p className="text-xs text-gray-400 mt-2">
                Note: You'll need to add a Google Maps API key to use this feature.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={() => {
            const spotName = prompt("Enter the name of the spot:")
            const spotAddress = prompt("Enter the address (optional):")
            if (spotName) {
              saveSpot(spotName, spotAddress || "")
            }
          }}
        >
          <Heart className="h-4 w-4 mr-2" />
          Save Current Location
        </Button>
      </div>
    </div>
  )
}

